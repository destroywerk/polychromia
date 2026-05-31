import * as Tone from 'tone';
import { NODE_DEFS } from './nodeDefs';

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

    this.masterRecorder = new Tone.Recorder();
    this.limiter.connect(this.masterRecorder);

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

  // ── Master recording / export ──────────────────────────
  async startRecording() {
    if (!this.initialized || this._recording) return;
    this.masterRecorder.start();
    this._recording = true;
  }
  async stopRecording() {
    if (!this._recording) return null;
    const blob = await this.masterRecorder.stop();
    this._recording = false;
    return blob;
  }
}

export const graphEngine = new GraphEngine();
