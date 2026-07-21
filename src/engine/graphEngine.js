import * as Tone from 'tone';
import { AudioWorkletNode as StdAudioWorkletNode, addAudioWorkletModule } from 'standardized-audio-context';
import { NODE_DEFS } from './nodeDefs';

// ── PCM WAV export helpers ───────────────────────────────────────────────
// Tone.Recorder / MediaRecorder only emit a COMPRESSED container (webm/opus),
// which is not a valid .wav. To produce a real, playable PCM WAV we capture the
// master output as Float32 PCM live and encode a 16-bit RIFF/WAVE file in JS.
function concatFloat32(chunks) {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

// AudioWorklet processor (registered from a Blob URL at runtime — no separate
// file needed). It forwards the master's Float32 PCM frames to the main thread.
// AudioWorklet is the reliable, non-deprecated replacement for ScriptProcessor,
// whose onaudioprocess was not firing here (so nothing was ever captured).
const RECORDER_WORKLET_SRC = `
class PolyRecorder extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length) {
      const l = input[0];
      const r = input.length > 1 ? input[1] : input[0];
      if (l && l.length) {
        // Copy: the underlying buffers are reused between render quanta.
        this.port.postMessage({ l: new Float32Array(l), r: new Float32Array(r) });
      }
    }
    return true; // keep the processor alive for the whole session
  }
}
registerProcessor('poly-recorder', PolyRecorder);
`;

function encodeWavPCM16(left, right, sampleRate) {
  const numChannels = 2;
  const numFrames = Math.min(left.length, right.length);
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);     // RIFF chunk size
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);                // fmt chunk size (PCM)
  view.setUint16(20, 1, true);                 // audio format = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);                // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    let l = Math.max(-1, Math.min(1, left[i]));
    let r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true); offset += 2;
    view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7fff, true); offset += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}

class GraphEngine {
  constructor() {
    this.handles = new Map();      // nodeId -> handle
    this.connections = new Map();  // connId -> { from:{node,port,kind}, to:{node,port,kind} }
    this.muted = new Set();        // nodeIds muted in the mixer
    this.soloed = new Set();       // nodeIds soloed in the mixer
    this.initialized = false;
    this.playing = false;
  }

  async init() {
    if (this.initialized) return;
    await Tone.start();

    this.master = new Tone.Gain(0.9);
    this.limiter = new Tone.Limiter(-2);
    this.master.connect(this.limiter);
    this.limiter.toDestination();

    this.analyser = new Tone.Analyser('waveform', 512);
    this.limiter.connect(this.analyser);
    this.masterMeter = new Tone.Meter();
    this.limiter.connect(this.masterMeter);

    Tone.getTransport().bpm.value = 70;
    // Transport runs by default so dropping in a source is immediately audible.
    Tone.getTransport().start();
    this.playing = true;

    this.initialized = true;
  }

  // ── Nodes ──────────────────────────────────────────────
  addNode(id, type, params) {
    const def = NODE_DEFS[type];
    if (!def) return null;
    const handle = def.create({ transport: Tone.getTransport() }, params);
    if (handle.isSource && handle.level) {
      const meter = new Tone.Meter({ smoothing: 0.85 });
      handle.level.connect(meter);
      handle._meter = meter;
    }
    // Insert a dedicated mixer/mute gain stage AFTER the node's own output so
    // mute/solo can gate it to 0/1 without ever touching the user's level fader.
    // The node's real output becomes this gain; rewire then routes from here.
    if (handle.isSource && handle.audioOut) {
      const mixGain = new Tone.Gain(1);
      try { handle.audioOut.connect(mixGain); } catch (e) {}
      handle._mixGain = mixGain;
      handle.audioOut = mixGain;
    }
    if (params.muted) this.muted.add(id);
    if (params.soloed) this.soloed.add(id);
    this.handles.set(id, handle);
    this.rewire();
    // Adopt current transport state so an added source sounds immediately when running.
    try { handle.setTransport?.(this.playing); } catch (e) {}
    this.recomputeMix();
    return handle;
  }

  removeNode(id) {
    // drop connections referencing this node
    for (const [cid, c] of this.connections) {
      if (c.from.node === id || c.to.node === id) this.connections.delete(cid);
    }
    this.muted.delete(id);
    this.soloed.delete(id);
    const handle = this.handles.get(id);
    if (handle) {
      try { handle.stop?.(); } catch (e) {}
      if (handle._meter) { try { handle._meter.dispose(); } catch (e) {} }
      const mg = handle._mixGain;
      setTimeout(() => { try { handle.dispose(); } catch (e) {} try { mg?.dispose(); } catch (e) {} }, 80);
      this.handles.delete(id);
    }
    this.rewire();
    this.recomputeMix();
  }

  updateParam(id, key, value) {
    const h = this.handles.get(id);
    // Guard the audio-side update so an unsupported value can never block the
    // caller (and thus the React params/UI update). Surface it as a warning.
    if (h) { try { h.update(key, value); } catch (e) { console.warn(`updateParam failed for ${id}.${key}=`, value, e); } }
  }

  // Remove every node + connection and dispose all handles so no orphaned
  // voices keep sounding. Resets mute/solo state and empties the graph.
  clearAll() {
    for (const [, h] of this.handles) {
      try { h.stop?.(); } catch (e) {}
      if (h._meter) { try { h._meter.dispose(); } catch (e) {} }
      const mg = h._mixGain;
      try { h.dispose(); } catch (e) {}
      try { mg?.dispose(); } catch (e) {}
    }
    this.handles.clear();
    this.connections.clear();
    this.muted.clear();
    this.soloed.clear();
  }

  getHandle(id) { return this.handles.get(id); }

  // ── Connections ────────────────────────────────────────
  canConnect(from, to) {
    if (from.node === to.node) return false;
    if (from.kind !== to.kind) return false;
    for (const c of this.connections.values()) {
      // never allow the exact same cable twice
      if (c.from.node === from.node && c.from.port === from.port && c.to.node === to.node && c.to.port === to.port) return false;
      // MOD inputs accept a single cable; AUDIO inputs may be fanned-in
      // (Tone.js sums multiple sources into one node) so several voices can
      // share a reverb/effect.
      if (to.kind === 'mod' && c.to.node === to.node && c.to.port === to.port) return false;
    }
    return true;
  }

  addConnection(id, from, to) {
    if (!this.canConnect(from, to)) return false;
    this.connections.set(id, { from, to });
    this.rewire();
    return true;
  }

  removeConnection(id) {
    this.connections.delete(id);
    this.rewire();
  }

  // Full re-wire of audio + mod graph. Terminal audio outs route to master.
  rewire() {
    if (!this.initialized) return;

    // 1. disconnect every node's audioOut + modOut
    for (const h of this.handles.values()) {
      if (h.audioOut) { try { h.audioOut.disconnect(); } catch (e) {} }
      if (h.modOut) { try { h.modOut.disconnect(); } catch (e) {} }
    }

    // 2. apply explicit connections
    const hasOutgoingAudio = new Set();
    for (const c of this.connections.values()) {
      const fromH = this.handles.get(c.from.node);
      const toH = this.handles.get(c.to.node);
      if (!fromH || !toH) continue;
      if (c.from.kind === 'audio' && fromH.audioOut && toH.audioIn) {
        try { fromH.audioOut.connect(toH.audioIn); hasOutgoingAudio.add(c.from.node); } catch (e) {}
      } else if (c.from.kind === 'mod' && fromH.modOut && toH.modIns && toH.modIns[c.to.port]) {
        try { fromH.modOut.connect(toH.modIns[c.to.port]); } catch (e) {}
      }
    }

    // 3. terminal audio outs -> master
    for (const [id, h] of this.handles) {
      if (h.audioOut && !hasOutgoingAudio.has(id)) {
        try { h.audioOut.connect(this.master); } catch (e) {}
      }
    }
  }

  // ── Mixer: mute / solo ─────────────────────────────────
  setMute(id, on) { if (on) this.muted.add(id); else this.muted.delete(id); this.recomputeMix(); }
  setSolo(id, on) { if (on) this.soloed.add(id); else this.soloed.delete(id); this.recomputeMix(); }

  // Gate each source's dedicated mix gain. Audibility (mixer layer):
  //   !muted && (noTracksSoloed || thisTrackSoloed)
  // This composes multiplicatively with per-node power (enabled), which is
  // handled independently by the source's own start/stop reconcile.
  recomputeMix() {
    const anySolo = this.soloed.size > 0;
    for (const [id, h] of this.handles) {
      if (!h._mixGain) continue;
      const audible = !this.muted.has(id) && (!anySolo || this.soloed.has(id));
      try { h._mixGain.gain.rampTo(audible ? 1 : 0, 0.08); } catch (e) {}
    }
  }

  // ── Transport ──────────────────────────────────────────
  play() {
    const t = Tone.getTransport();
    t.start();
    this.playing = true;
    for (const h of this.handles.values()) { try { h.setTransport?.(true); } catch (e) {} }
  }

  pause() {
    Tone.getTransport().pause();
    this.playing = false;
    for (const h of this.handles.values()) { try { h.setTransport?.(false); } catch (e) {} }
  }

  stop() {
    const t = Tone.getTransport();
    t.stop();
    t.position = 0;
    this.playing = false;
    for (const h of this.handles.values()) { try { h.setTransport?.(false); } catch (e) {} }
  }

  setBpm(bpm) { if (this.initialized) Tone.getTransport().bpm.rampTo(bpm, 0.1); }

  setMasterVolume(v) { if (this.master) this.master.gain.rampTo(v, 0.1); }

  // ── Meters / Scope ─────────────────────────────────────
  getWaveform() { return this.analyser ? this.analyser.getValue() : null; }
  getMasterLevel() { return this.masterMeter ? this.masterMeter.getValue() : -Infinity; }
  getNodeLevel(id) {
    const h = this.handles.get(id);
    if (h && h._meter) return h._meter.getValue();
    return -Infinity;
  }

  // ── Master recording / export ──────────────────────────────────────────
  // Strategy: try true PCM WAV via an AudioWorklet, but VERIFY it is actually
  // producing frames shortly after start; if not (silent worklet — the failure
  // mode that bit the last 2 attempts) automatically swap to a MediaRecorder
  // fallback which always yields a playable file (saved with its real
  // extension/mime, never a faked .wav). Any thrown error also drops to the
  // fallback, and a hard failure is reported back to the UI.

  async _ensureRecorderWorklet(rawCtx) {
    if (this._recWorkletReady) return;
    const blob = new Blob([RECORDER_WORKLET_SRC], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      // Use standardized-audio-context's loader so it matches Tone's wrapped
      // context (the native ctx.audioWorklet.addModule is incompatible with it).
      await addAudioWorkletModule(rawCtx, url);
      this._recWorkletReady = true;
      console.info('[rec] worklet module registered ✓');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async _startWorklet(rawCtx) {
    await this._ensureRecorderWorklet(rawCtx);
    this._recRate = rawCtx.sampleRate;
    this._recL = [];
    this._recR = [];
    this._recFrames = 0;
    // Construct via standardized-audio-context so the node is created against
    // Tone's wrapped context (native AudioWorkletNode rejects that context with
    // "parameter 1 is not of type 'BaseAudioContext'").
    const node = new StdAudioWorkletNode(rawCtx, 'poly-recorder', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    });
    node.port.onmessage = (ev) => {
      if (this._recFrames === 0) console.info('[rec] worklet delivering frames ✓');
      this._recL.push(ev.data.l);
      this._recR.push(ev.data.r);
      this._recFrames += ev.data.l.length;
    };
    // CRITICAL: an AudioWorkletNode's process() only runs while the node is
    // pulled by the graph — i.e. connected (transitively) to ctx.destination.
    // Route its (silent) output through a 0-gain sink into the RAW destination
    // so the processor is rendered without adding anything audible.
    const sink = rawCtx.createGain();
    sink.gain.value = 0;
    node.connect(sink);
    sink.connect(rawCtx.destination);
    this.limiter.connect(node);
    this._recNode = node;
    this._recSink = sink;
  }

  _teardownWorklet() {
    try { this.limiter.disconnect(this._recNode); } catch (e) {}
    if (this._recNode) {
      try { this._recNode.port.onmessage = null; } catch (e) {}
      try { this._recNode.disconnect(); } catch (e) {}
    }
    if (this._recSink) { try { this._recSink.disconnect(); } catch (e) {} }
    this._recNode = null;
    this._recSink = null;
  }

  _startMediaRecorder(rawCtx) {
    if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder unsupported');
    const dest = rawCtx.createMediaStreamDestination();
    this.limiter.connect(dest);
    this._recDest = dest;
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4'];
    let mime = '';
    for (const c of candidates) { try { if (MediaRecorder.isTypeSupported(c)) { mime = c; break; } } catch (e) {} }
    const mr = mime ? new MediaRecorder(dest.stream, { mimeType: mime }) : new MediaRecorder(dest.stream);
    this._recMime = mr.mimeType || mime || 'audio/webm';
    this._recExt = /ogg/.test(this._recMime) ? 'ogg' : /mp4/.test(this._recMime) ? 'm4a' : 'webm';
    this._recChunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) this._recChunks.push(e.data); };
    mr.start(1000); // flush a chunk every second so long sessions aren't lost
    this._recMR = mr;
  }

  _stopMediaRecorder() {
    return new Promise((resolve) => {
      const mr = this._recMR;
      if (!mr) return resolve(null);
      mr.onstop = () => {
        const blob = new Blob(this._recChunks || [], { type: this._recMime || 'audio/webm' });
        try { this.limiter.disconnect(this._recDest); } catch (e) {}
        this._recChunks = null; this._recMR = null; this._recDest = null;
        resolve(blob.size ? blob : null);
      };
      try { mr.stop(); } catch (e) { resolve(null); }
    });
  }

  _swapToFallback(rawCtx) {
    try {
      this._teardownWorklet();
      this._recL = this._recR = null;
      this._startMediaRecorder(rawCtx);
      this._recMethod = 'media';
      console.info('[rec] fallback active (MediaRecorder)', this._recMime);
    } catch (e) {
      console.error('[rec] fallback swap failed', e);
    }
  }

  async startRecording() {
    if (!this.initialized) return { ok: false, error: 'Audio engine not started' };
    if (this._recording) return { ok: false, error: 'Already recording' };
    const rawCtx = Tone.getContext().rawContext;
    if (rawCtx.state === 'suspended') { try { await rawCtx.resume(); } catch (e) {} }

    // Preferred: AudioWorklet → true PCM WAV.
    try {
      await this._startWorklet(rawCtx);
      this._recMethod = 'worklet';
      this._recording = true;
      console.info('[rec] started (AudioWorklet) @', this._recRate, 'Hz');
      // Verify frames are actually flowing; if not, silently swap to fallback.
      this._verifyTimer = setTimeout(() => {
        console.info('[rec] worklet frames after 700ms:', this._recFrames);
        if (this._recording && this._recMethod === 'worklet' && this._recFrames === 0) {
          console.warn('[rec] worklet silent — switching to MediaRecorder fallback');
          this._swapToFallback(rawCtx);
        }
      }, 700);
      return { ok: true, method: 'worklet' };
    } catch (e) {
      console.error('[rec] worklet path failed; trying MediaRecorder fallback', e);
    }

    // Fallback: MediaStreamDestination + MediaRecorder (real container/ext).
    try {
      this._startMediaRecorder(rawCtx);
      this._recMethod = 'media';
      this._recording = true;
      console.info('[rec] started (MediaRecorder fallback)', this._recMime);
      return { ok: true, method: 'media' };
    } catch (e) {
      console.error('[rec] MediaRecorder fallback failed', e);
      this._recording = false;
      return { ok: false, error: e?.message || 'Recording failed to start' };
    }
  }

  async stopRecording() {
    if (!this._recording) return null;
    this._recording = false;
    if (this._verifyTimer) { clearTimeout(this._verifyTimer); this._verifyTimer = null; }

    if (this._recMethod === 'media') {
      const raw = await this._stopMediaRecorder();
      if (!raw) { console.warn('[rec] no audio captured (media)'); return null; }
      console.info(`[rec] stopped (media) — ${(raw.size / 1048576).toFixed(2)} MB ${this._recMime}`);
      // The user wants a WAV even on the fallback: decode the compressed
      // container to PCM and re-encode through the verified WAV encoder. The
      // result is a valid, full-length WAV (lossy if the source was opus).
      try {
        const arr = await raw.arrayBuffer();
        const rawCtx = Tone.getContext().rawContext;
        const audioBuf = await rawCtx.decodeAudioData(arr);
        const left = audioBuf.getChannelData(0);
        const right = audioBuf.numberOfChannels > 1 ? audioBuf.getChannelData(1) : left;
        const wav = encodeWavPCM16(left, right, audioBuf.sampleRate);
        console.info(`[rec] fallback decoded → WAV (${(wav.size / 1048576).toFixed(2)} MB, ~${audioBuf.duration.toFixed(1)}s)`);
        return { blob: wav, ext: 'wav', mime: 'audio/wav' };
      } catch (e) {
        // Last resort: save the raw container with its real extension so it at
        // least plays. The UI surfaces this via recError from useGraph.
        console.warn('[rec] could not decode fallback to WAV — saving raw container', e);
        return { blob: raw, ext: this._recExt || 'webm', mime: this._recMime || 'audio/webm', degraded: true };
      }
    }

    // worklet path → encode PCM WAV
    this._teardownWorklet();
    const left = concatFloat32(this._recL || []);
    const right = concatFloat32(this._recR || []);
    const secs = (left.length / (this._recRate || 44100)).toFixed(1);
    this._recL = this._recR = null;
    if (!left.length) { console.warn('[rec] no audio captured (worklet)'); return null; }
    console.info(`[rec] stopped (worklet) — ${left.length} samples/ch (~${secs}s)`);
    return { blob: encodeWavPCM16(left, right, this._recRate || 44100), ext: 'wav', mime: 'audio/wav' };
  }
}

export const graphEngine = new GraphEngine();
