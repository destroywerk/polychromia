import * as Tone from 'tone';
import { getChordNotes } from './theory';

// Port kinds: 'audio' (signal) | 'mod' (control-rate modulation)
// Each create(ctx, params) returns a handle:
//   { audioIn, audioOut, modOut, modIns, level, pan, isSource,
//     play(), stop(), update(key,val), setTransport(playing), dispose() }

const ACCENT = {
  source: '#8fbaa9',
  sequence: '#6f8fc4',
  mod: '#9a93d4',
  effect: '#d48fb0',
  stream: '#c2cf8a',
  looper: '#d98fc4',
  io: '#c9a878',
};

function makeOscSynth(wave, envelope) {
  if (wave === 'fm') return new Tone.PolySynth(Tone.FMSynth, { modulationIndex: 8, envelope, modulationEnvelope: { attack: envelope.attack, decay: 0.1, sustain: 1, release: envelope.release } });
  if (wave === 'am') return new Tone.PolySynth(Tone.AMSynth, { envelope, harmonicity: 2 });
  return new Tone.PolySynth(Tone.Synth, { oscillator: { type: wave }, envelope });
}

export const NODE_DEFS = {
  // ─────────────────────────── SOURCES ───────────────────────────
  oscillator: {
    label: 'Oscillator',
    category: 'source',
    accent: ACCENT.source,
    width: 210,
    inputs: [{ id: 'level', kind: 'mod' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { wave: 'triangle', root: 'C', octave: 2, chord: 'add9', level: 0.5, pan: 0, attack: 3, release: 6, detune: 0, enabled: true },
    create(ctx, p) {
      const envelope = { attack: p.attack, decay: 0.1, sustain: 1, release: p.release };
      let synth = makeOscSynth(p.wave, envelope);
      const level = new Tone.Gain(p.level);
      const pan = new Tone.Panner(p.pan);
      synth.connect(level); level.connect(pan);
      synth.set({ detune: p.detune });

      const state = { ...p, enabled: p.enabled !== false, transportOn: false, running: false };
      const notes = () => getChordNotes(state.root, state.octave, state.chord);

      const handle = {
        audioIn: null, audioOut: pan, modOut: null,
        modIns: { level: level.gain },
        level, pan, isSource: true,
        _reconcile() {
          const should = state.enabled && state.transportOn;
          if (should && !state.running) { try { synth.triggerAttack(notes()); } catch (e) {} state.running = true; }
          else if (!should && state.running) { try { synth.releaseAll(); } catch (e) {} state.running = false; }
        },
        setEnabled(on) { state.enabled = on; this._reconcile(); },
        setTransport(on) { state.transportOn = on; this._reconcile(); },
        play() { state.enabled = true; this._reconcile(); },
        stop() { state.enabled = false; this._reconcile(); },
        update(key, val) {
          state[key] = val;
          if (key === 'level') level.gain.rampTo(val, 0.08);
          else if (key === 'pan') pan.pan.rampTo(val, 0.08);
          else if (key === 'detune') { try { synth.set({ detune: val }); } catch (e) {} }
          else if (key === 'attack' || key === 'release') {
            try { synth.set({ envelope: { attack: state.attack, decay: 0.1, sustain: 1, release: state.release } }); } catch (e) {}
          } else if (key === 'wave') {
            const wasRunning = state.running;
            try { synth.releaseAll(); } catch (e) {}
            try { synth.disconnect(); } catch (e) {}
            const old = synth;
            setTimeout(() => { try { old.dispose(); } catch (e) {} }, 60);
            synth = makeOscSynth(val, { attack: state.attack, decay: 0.1, sustain: 1, release: state.release });
            synth.set({ detune: state.detune });
            synth.connect(level);
            if (wasRunning) { try { synth.triggerAttack(notes()); } catch (e) {} }
          } else if (key === 'root' || key === 'octave' || key === 'chord') {
            if (state.running) { try { synth.releaseAll(); } catch (e) {} try { synth.triggerAttack(notes()); } catch (e) {} }
          }
        },
        dispose() { try { synth.releaseAll(); } catch (e) {} const old = synth; setTimeout(() => { try { old.dispose(); } catch (e) {} }, 100); level.dispose(); pan.dispose(); },
      };
      return handle;
    },
  },

  // Lush evolving pad: a chord stack run through a slow, deep chorus so it
  // shimmers and drifts on its own. Best default "drone" voice.
  drift: {
    label: 'Drift Pad',
    category: 'source',
    accent: ACCENT.source,
    width: 286,
    inputs: [{ id: 'level', kind: 'mod' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { root: 'C', octave: 2, chord: 'maj7', spread: 0.6, motion: 0.18, level: 0.5, pan: 0, attack: 4, release: 6, enabled: true },
    create(ctx, p) {
      const synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: p.attack, decay: 0.5, sustain: 1, release: p.release } });
      const chorus = new Tone.Chorus({ frequency: Math.max(0.01, p.motion), delayTime: 7, depth: p.spread, spread: 180, wet: 0.75 }).start();
      const level = new Tone.Gain(p.level);
      const pan = new Tone.Panner(p.pan);
      synth.connect(chorus); chorus.connect(level); level.connect(pan);
      const state = { ...p, enabled: p.enabled !== false, transportOn: false, running: false };
      const notes = () => getChordNotes(state.root, state.octave, state.chord);
      const handle = {
        audioIn: null, audioOut: pan, modOut: null,
        modIns: { level: level.gain },
        level, pan, isSource: true,
        _reconcile() {
          const should = state.enabled && state.transportOn;
          if (should && !state.running) { try { synth.triggerAttack(notes()); } catch (e) {} state.running = true; }
          else if (!should && state.running) { try { synth.releaseAll(); } catch (e) {} state.running = false; }
        },
        setEnabled(on) { state.enabled = on; this._reconcile(); },
        setTransport(on) { state.transportOn = on; this._reconcile(); },
        play() { state.enabled = true; this._reconcile(); },
        stop() { state.enabled = false; this._reconcile(); },
        update(key, val) {
          state[key] = val;
          if (key === 'level') level.gain.rampTo(val, 0.1);
          else if (key === 'pan') pan.pan.rampTo(val, 0.1);
          else if (key === 'spread') chorus.depth = val;
          else if (key === 'motion') { try { chorus.frequency.value = Math.max(0.01, val); } catch (e) {} }
          else if (key === 'attack' || key === 'release') { try { synth.set({ envelope: { attack: state.attack, decay: 0.5, sustain: 1, release: state.release } }); } catch (e) {} }
          else if (key === 'root' || key === 'octave' || key === 'chord') {
            if (state.running) { try { synth.releaseAll(); } catch (e) {} try { synth.triggerAttack(notes()); } catch (e) {} }
          }
        },
        dispose() { try { synth.releaseAll(); } catch (e) {} [synth, chorus, level, pan].forEach((nd) => { try { nd.dispose(); } catch (e) {} }); },
      };
      return handle;
    },
  },

  // Granular shimmer cloud: a cluster of continuously-running detuned sine
  // oscillators, each with its own slow amplitude + pitch drift, gated in/out
  // by an envelope. Evolving, breathing texture.
  grain: {
    label: 'Grain Cloud',
    category: 'source',
    accent: ACCENT.source,
    width: 215,
    inputs: [{ id: 'level', kind: 'mod' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { root: 'C', octave: 3, chord: 'maj7', density: 5, drift: 14, shimmer: 0.4, level: 0.45, pan: 0, attack: 3, release: 5, enabled: true },
    create(ctx, p) {
      const gate = new Tone.Gain(0);   // enable/disable envelope
      const level = new Tone.Gain(p.level);
      const pan = new Tone.Panner(p.pan);
      gate.connect(level); level.connect(pan);
      const state = { ...p, enabled: p.enabled !== false, transportOn: false, running: false };
      let voices = [];

      const clearVoices = () => {
        voices.forEach((v) => {
          try { v.osc.stop(); } catch (e) {}
          [v.osc, v.amp, v.ampLfo, v.driftLfo].forEach((nd) => { try { nd.dispose(); } catch (e) {} });
        });
        voices = [];
      };
      const buildVoices = () => {
        clearVoices();
        const ns = getChordNotes(state.root, state.octave, state.chord);
        const count = Math.max(2, Math.min(8, Math.round(state.density)));
        for (let i = 0; i < count; i++) {
          const amp = new Tone.Gain(0.0);
          const osc = new Tone.Oscillator({ frequency: ns[i % ns.length], type: 'sine' }).start();
          const ampLfo = new Tone.LFO({ frequency: 0.06 + Math.random() * 0.5, min: 0.02, max: 0.04 + state.shimmer * 0.22, type: 'sine', phase: Math.random() * 360 }).start();
          ampLfo.connect(amp.gain);
          const driftLfo = new Tone.LFO({ frequency: 0.02 + Math.random() * 0.09, min: -state.drift, max: state.drift, type: 'triangle', phase: Math.random() * 360 }).start();
          driftLfo.connect(osc.detune);
          osc.connect(amp); amp.connect(gate);
          voices.push({ osc, amp, ampLfo, driftLfo });
        }
      };
      buildVoices();

      const handle = {
        audioIn: null, audioOut: pan, modOut: null,
        modIns: { level: level.gain },
        level, pan, isSource: true,
        _reconcile() {
          const should = state.enabled && state.transportOn;
          if (should && !state.running) { gate.gain.rampTo(1, Math.max(0.05, state.attack)); state.running = true; }
          else if (!should && state.running) { gate.gain.rampTo(0, Math.max(0.05, state.release)); state.running = false; }
        },
        setEnabled(on) { state.enabled = on; this._reconcile(); },
        setTransport(on) { state.transportOn = on; this._reconcile(); },
        play() { state.enabled = true; this._reconcile(); },
        stop() { state.enabled = false; this._reconcile(); },
        update(key, val) {
          state[key] = val;
          if (key === 'level') level.gain.rampTo(val, 0.1);
          else if (key === 'pan') pan.pan.rampTo(val, 0.1);
          else if (key === 'shimmer') voices.forEach((v) => { try { v.ampLfo.max = 0.04 + val * 0.22; } catch (e) {} });
          else if (key === 'drift') voices.forEach((v) => { try { v.driftLfo.min = -val; v.driftLfo.max = val; } catch (e) {} });
          else if (key === 'root' || key === 'octave' || key === 'chord' || key === 'density') buildVoices();
        },
        dispose() { clearVoices(); [gate, level, pan].forEach((nd) => { try { nd.dispose(); } catch (e) {} }); },
      };
      return handle;
    },
  },

  // Filtered noise bed: pink/white/brown noise through a moving band-pass for
  // airy wind / surf / static textures. Unpitched, so it has tone "color"
  // (filter freq) and "motion" (slow cutoff LFO) instead of a key.
  noise: {
    label: 'Noise Bed',
    category: 'source',
    accent: ACCENT.source,
    width: 205,
    inputs: [{ id: 'level', kind: 'mod' }, { id: 'cutoff', kind: 'mod' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { color: 'pink', cutoff: 700, q: 1.4, motion: 0.05, level: 0.4, pan: 0, attack: 3, release: 4, enabled: true },
    create(ctx, p) {
      const noise = new Tone.Noise(p.color).start();
      const filter = new Tone.Filter({ frequency: p.cutoff, type: 'bandpass', Q: p.q });
      const cutoffMod = new Tone.Gain(4000);   // external cutoff mod input scale
      cutoffMod.connect(filter.frequency);
      const motionLfo = new Tone.LFO({ frequency: Math.max(0.01, p.motion), min: -1, max: 1, type: 'sine' }).start();
      const motionScale = new Tone.Gain(p.cutoff * 0.5);
      motionLfo.connect(motionScale); motionScale.connect(filter.frequency);
      const gate = new Tone.Gain(0);
      const level = new Tone.Gain(p.level);
      const pan = new Tone.Panner(p.pan);
      noise.connect(filter); filter.connect(gate); gate.connect(level); level.connect(pan);
      const state = { ...p, enabled: p.enabled !== false, transportOn: false, running: false };
      return {
        audioIn: null, audioOut: pan, modOut: null,
        modIns: { level: level.gain, cutoff: cutoffMod },
        level, pan, isSource: true,
        _reconcile() {
          const should = state.enabled && state.transportOn;
          if (should && !state.running) { gate.gain.rampTo(1, Math.max(0.05, state.attack)); state.running = true; }
          else if (!should && state.running) { gate.gain.rampTo(0, Math.max(0.05, state.release)); state.running = false; }
        },
        setEnabled(on) { state.enabled = on; this._reconcile(); },
        setTransport(on) { state.transportOn = on; this._reconcile(); },
        play() { state.enabled = true; this._reconcile(); },
        stop() { state.enabled = false; this._reconcile(); },
        update(key, val) {
          state[key] = val;
          if (key === 'level') level.gain.rampTo(val, 0.1);
          else if (key === 'pan') pan.pan.rampTo(val, 0.1);
          else if (key === 'color') noise.type = val;
          else if (key === 'cutoff') { filter.frequency.rampTo(val, 0.2); motionScale.gain.rampTo(val * 0.5, 0.2); }
          else if (key === 'q') filter.Q.rampTo(val, 0.1);
          else if (key === 'motion') { try { motionLfo.frequency.rampTo(Math.max(0.01, val), 0.2); } catch (e) {} }
        },
        dispose() { try { noise.stop(); } catch (e) {} [noise, filter, cutoffMod, motionLfo, motionScale, gate, level, pan].forEach((nd) => { try { nd.dispose(); } catch (e) {} }); },
      };
    },
  },

  noteCycler: {
    label: 'Sequencer',
    category: 'sequence',
    accent: ACCENT.sequence,
    width: 210,
    inputs: [{ id: 'level', kind: 'mod' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { notes: ['C3', 'D#3', 'G3', 'A#3'], division: '2n', mode: 'up', wave: 'sine', level: 0.5, pan: 0, gate: 0.95, enabled: true },
    create(ctx, p) {
      const synth = new Tone.Synth({ oscillator: { type: p.wave }, envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 } });
      const level = new Tone.Gain(p.level);
      const pan = new Tone.Panner(p.pan);
      synth.connect(level); level.connect(pan);
      const state = { ...p, idx: 0, enabled: p.enabled !== false, transportOn: false, running: false };
      let loop = null;

      const nextNote = () => {
        const list = state.notes;
        if (!list.length) return null;
        if (state.mode === 'random') return list[Math.floor(Math.random() * list.length)];
        if (state.mode === 'down') { const n = list[(list.length - 1 - (state.idx % list.length))]; state.idx++; return n; }
        const n = list[state.idx % list.length]; state.idx++; return n;
      };

      const buildLoop = () => {
        if (loop) { loop.dispose(); loop = null; }
        loop = new Tone.Loop((time) => {
          const n = nextNote();
          if (n) synth.triggerAttackRelease(n, Tone.Time(state.division).toSeconds() * state.gate, time);
        }, state.division).start(0);
      };

      const handle = {
        audioIn: null, audioOut: pan, modOut: null,
        modIns: { level: level.gain },
        level, pan, isSource: true,
        _reconcile() {
          const should = state.enabled && state.transportOn;
          if (should && !state.running) { state.idx = 0; buildLoop(); state.running = true; }
          else if (!should && state.running) { if (loop) { loop.dispose(); loop = null; } try { synth.triggerRelease(); } catch (e) {} state.running = false; }
        },
        setEnabled(on) { state.enabled = on; this._reconcile(); },
        setTransport(on) { state.transportOn = on; this._reconcile(); },
        play() { state.enabled = true; this._reconcile(); },
        stop() { state.enabled = false; this._reconcile(); },
        update(key, val) {
          state[key] = val;
          if (key === 'level') level.gain.rampTo(val, 0.08);
          else if (key === 'pan') pan.pan.rampTo(val, 0.08);
          else if (key === 'wave') synth.set({ oscillator: { type: val } });
          else if (key === 'division' && state.running) buildLoop();
        },
        dispose() { if (loop) loop.dispose(); try { synth.dispose(); } catch (e) {} level.dispose(); pan.dispose(); },
      };
      return handle;
    },
  },

  progression: {
    label: 'Progression',
    category: 'sequence',
    accent: ACCENT.sequence,
    width: 230,
    inputs: [{ id: 'level', kind: 'mod' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: {
      steps: [
        { root: 'A#', octave: 3, chord: 'maj7' },
        { root: 'C#', octave: 4, chord: 'maj7' },
        { root: 'A#', octave: 3, chord: 'add9' },
        { root: 'F', octave: 3, chord: 'm11' },
      ],
      beats: 8, wave: 'sine', level: 0.6, pan: 0, mode: 'order', enabled: true,
    },
    create(ctx, p) {
      const synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: p.wave }, envelope: { attack: 2, decay: 0.3, sustain: 1, release: 4 } });
      const level = new Tone.Gain(p.level);
      const pan = new Tone.Panner(p.pan);
      synth.connect(level); level.connect(pan);
      const state = { ...p, idx: 0, enabled: p.enabled !== false, transportOn: false, running: false };
      let loop = null;

      const buildLoop = () => {
        if (loop) { loop.dispose(); loop = null; }
        loop = new Tone.Loop((time) => {
          try { synth.releaseAll(); } catch (e) {}
          let i;
          if (state.mode === 'random') i = Math.floor(Math.random() * state.steps.length);
          else { i = state.idx % state.steps.length; state.idx++; }
          const s = state.steps[i];
          if (s) synth.triggerAttack(getChordNotes(s.root, s.octave, s.chord), time);
          handle._activeStep = i;
          if (handle.onStep) handle.onStep(i);
        }, `${state.beats * 0.25}m`).start(0);
      };

      const handle = {
        audioIn: null, audioOut: pan, modOut: null,
        modIns: { level: level.gain },
        level, pan, isSource: true, _activeStep: 0,
        _reconcile() {
          const should = state.enabled && state.transportOn;
          if (should && !state.running) { state.idx = 0; buildLoop(); state.running = true; }
          else if (!should && state.running) { if (loop) { loop.dispose(); loop = null; } try { synth.releaseAll(); } catch (e) {} state.running = false; }
        },
        setEnabled(on) { state.enabled = on; this._reconcile(); },
        setTransport(on) { state.transportOn = on; this._reconcile(); },
        play() { state.enabled = true; this._reconcile(); },
        stop() { state.enabled = false; this._reconcile(); },
        update(key, val) {
          state[key] = val;
          if (key === 'level') level.gain.rampTo(val, 0.08);
          else if (key === 'pan') pan.pan.rampTo(val, 0.08);
          else if (key === 'wave') synth.set({ oscillator: { type: val } });
          else if ((key === 'beats' || key === 'steps') && state.running) buildLoop();
        },
        dispose() { if (loop) loop.dispose(); try { synth.dispose(); } catch (e) {} level.dispose(); pan.dispose(); },
      };
      return handle;
    },
  },

  stream: {
    label: 'Radio Stream',
    category: 'stream',
    accent: ACCENT.stream,
    width: 220,
    inputs: [],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { stationName: '', url: '', level: 0.7, pan: 0, enabled: true },
    create(ctx, p) {
      const level = new Tone.Gain(p.level);
      const pan = new Tone.Panner(p.pan);
      level.connect(pan);
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'none';
      audio.loop = false;
      let source = null;
      const state = { ...p, connected: false, enabled: p.enabled !== false, transportOn: false };

      // Route the <audio> element through Web Audio so downstream effects
      // (delay/warp/filter/eq/reverb) actually process it. Created eagerly as
      // soon as a URL exists; if it fails (CORS) we still allow stop().
      const ensureSource = () => {
        if (source) return;
        try {
          source = Tone.getContext().rawContext.createMediaElementSource(audio);
          Tone.connect(source, level);
          state.connected = true;
        } catch (e) {
          state.connected = false;
          console.warn('stream: could not route through Web Audio (CORS?) — effects may not apply', e?.message || e);
        }
      };

      const handle = {
        audioIn: null, audioOut: pan, modOut: null, modIns: {},
        level, pan, isSource: true, audioEl: audio,
        play() {
          if (!state.url) return;
          if (audio.src !== state.url) { try { audio.src = state.url; } catch (e) {} }
          ensureSource();
          const pr = audio.play();
          if (pr && pr.catch) pr.catch((e) => console.warn('stream play blocked', e?.message || e));
        },
        stop() { try { audio.pause(); } catch (e) {} },
        setEnabled(on) { state.enabled = on; on ? this.play() : this.stop(); },
        setTransport(on) { state.transportOn = on; if (!on) this.stop(); else if (state.enabled) this.play(); },
        update(key, val) {
          state[key] = val;
          if (key === 'level') level.gain.rampTo(val, 0.08);
          else if (key === 'pan') pan.pan.rampTo(val, 0.08);
          else if (key === 'url') { if (audio.src !== val) { try { audio.src = val; } catch (e) {} } ensureSource(); }
        },
        dispose() {
          try { audio.pause(); } catch (e) {}
          try { audio.src = ''; audio.load(); } catch (e) {}
          try { if (source) source.disconnect(); } catch (e) {}
          [level, pan].forEach((nd) => { try { nd.dispose(); } catch (e) {} });
        },
      };
      return handle;
    },
  },

  looper: {
    label: 'Loop Recorder',
    category: 'looper',
    accent: ACCENT.looper,
    width: 230,
    inputs: [{ id: 'in', kind: 'audio' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { level: 0.85, pan: 0, reverse: false, status: 'idle', hasLoop: false, enabled: true },
    create(ctx, p) {
      const input = new Tone.Gain(1);          // audio in (tap for recording)
      const recorder = new Tone.Recorder();
      input.connect(recorder);
      const level = new Tone.Gain(p.level);
      const pan = new Tone.Panner(p.pan);
      level.connect(pan);
      // Monitor pass-through: hear the live patched source while/after recording,
      // alongside any loop playback (both sum into `level`).
      input.connect(level);
      let player = null;
      const state = { ...p, enabled: p.enabled !== false };

      const handle = {
        audioIn: input, audioOut: pan, modOut: null, modIns: {},
        level, pan, isSource: true,
        async record() {
          if (recorder.state === 'started') return;
          recorder.start();
          state.status = 'recording';
          if (handle.onState) handle.onState('recording');
        },
        async stopRecord() {
          if (recorder.state !== 'started') return;
          const blob = await recorder.stop();
          state.status = 'idle';
          try {
            const arr = await blob.arrayBuffer();
            const audioBuf = await Tone.getContext().rawContext.decodeAudioData(arr);
            if (player) { try { player.stop(); player.dispose(); } catch (e) {} }
            player = new Tone.Player(audioBuf);
            player.loop = true;
            player.reverse = state.reverse;
            player.connect(level);
            state.hasLoop = true;
            if (handle.onState) handle.onState('ready');
          } catch (e) { console.warn('loop decode error', e); if (handle.onState) handle.onState('idle'); }
        },
        trigger() {
          if (!player) return;
          try { player.stop(); } catch (e) {}
          player.start();
          state.status = 'playing';
          if (handle.onState) handle.onState('playing');
        },
        stopLoop() { if (player) { try { player.stop(); } catch (e) {} } state.status = 'ready'; if (handle.onState) handle.onState('ready'); },
        play() { if (player && state.status !== 'playing') this.trigger(); },
        stop() { this.stopLoop(); },
        setEnabled(on) { state.enabled = on; if (!on) this.stopLoop(); else if (player) this.trigger(); },
        setTransport(playing) { if (!playing) this.stopLoop(); },
        update(key, val) {
          state[key] = val;
          if (key === 'level') level.gain.rampTo(val, 0.08);
          else if (key === 'pan') pan.pan.rampTo(val, 0.08);
          else if (key === 'reverse' && player) player.reverse = val;
        },
        dispose() { if (player) { try { player.stop(); player.dispose(); } catch (e) {} } try { recorder.dispose(); } catch (e) {} input.dispose(); level.dispose(); pan.dispose(); },
      };
      return handle;
    },
  },

  // ─────────────────────────── MODULATION ───────────────────────────
  lfo: {
    label: 'LFO',
    category: 'mod',
    accent: ACCENT.mod,
    width: 190,
    inputs: [],
    outputs: [{ id: 'mod', kind: 'mod' }],
    defaults: { rate: 0.3, depth: 0.5, shape: 'sine' },
    create(ctx, p) {
      // LFO outputs a normalised bipolar signal scaled by depth (±depth).
      // Each mod-input target applies its own scaling (e.g. filter cutoff ×6000 Hz).
      const lfo = new Tone.LFO({ frequency: p.rate, min: -1, max: 1, type: p.shape }).start();
      const scale = new Tone.Gain(p.depth);
      lfo.connect(scale);
      const state = { ...p };
      return {
        audioIn: null, audioOut: null, modOut: scale, modIns: {}, isSource: false,
        play() {}, stop() {}, setTransport() {},
        update(key, val) {
          state[key] = val;
          if (key === 'rate') lfo.frequency.rampTo(val, 0.1);
          else if (key === 'depth') scale.gain.rampTo(val, 0.1);
          else if (key === 'shape') lfo.type = val;
        },
        dispose() { try { lfo.stop(); lfo.dispose(); } catch (e) {} scale.dispose(); },
        _lfo: lfo,
      };
    },
  },

  // ─────────────────────────── EFFECTS ───────────────────────────
  filter: {
    label: 'Filter',
    category: 'effect',
    accent: ACCENT.effect,
    width: 200,
    inputs: [{ id: 'in', kind: 'audio' }, { id: 'cutoff', kind: 'mod' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { type: 'lowpass', cutoff: 1200, resonance: 1.5 },
    create(ctx, p) {
      const filter = new Tone.Filter({ frequency: p.cutoff, type: p.type, Q: p.resonance, rolloff: -24 });
      // Scale the normalised LFO (±depth) into a useful cutoff sweep in Hz.
      const cutoffMod = new Tone.Gain(6000);
      cutoffMod.connect(filter.frequency);
      const state = { ...p };
      return {
        audioIn: filter, audioOut: filter, modOut: null,
        modIns: { cutoff: cutoffMod }, isSource: false,
        play() {}, stop() {}, setTransport() {},
        update(key, val) {
          state[key] = val;
          if (key === 'cutoff') filter.frequency.rampTo(val, 0.1);
          else if (key === 'resonance') filter.Q.rampTo(val, 0.1);
          else if (key === 'type') filter.type = val;
        },
        dispose() { try { cutoffMod.dispose(); } catch (e) {} filter.dispose(); },
      };
    },
  },

  delay: {
    label: 'Delay',
    category: 'effect',
    accent: ACCENT.effect,
    width: 200,
    inputs: [{ id: 'in', kind: 'audio' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { time: '8n', feedback: 0.45, wet: 0.4 },
    create(ctx, p) {
      const delay = new Tone.FeedbackDelay({ delayTime: p.time, feedback: p.feedback, wet: p.wet });
      const state = { ...p };
      return {
        audioIn: delay, audioOut: delay, modOut: null, modIns: {}, isSource: false,
        play() {}, stop() {}, setTransport() {},
        update(key, val) {
          state[key] = val;
          if (key === 'time') delay.delayTime.rampTo(val, 0.1);
          else if (key === 'feedback') delay.feedback.rampTo(val, 0.1);
          else if (key === 'wet') delay.wet.rampTo(val, 0.1);
        },
        dispose() { delay.dispose(); },
      };
    },
  },

  reverb: {
    label: 'Reverb',
    category: 'effect',
    accent: ACCENT.effect,
    width: 200,
    inputs: [{ id: 'in', kind: 'audio' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { decay: 4, wet: 0.45 },
    create(ctx, p) {
      const reverb = new Tone.Reverb({ decay: p.decay, wet: p.wet });
      const state = { ...p };
      return {
        audioIn: reverb, audioOut: reverb, modOut: null, modIns: {}, isSource: false,
        play() {}, stop() {}, setTransport() {},
        update(key, val) {
          state[key] = val;
          if (key === 'wet') reverb.wet.rampTo(val, 0.1);
          else if (key === 'decay') { reverb.decay = Math.max(0.3, val); }
        },
        dispose() { reverb.dispose(); },
      };
    },
  },

  eq: {
    label: 'EQ',
    category: 'effect',
    accent: ACCENT.effect,
    width: 200,
    inputs: [{ id: 'in', kind: 'audio' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { low: 0, mid: 0, high: 0 },
    create(ctx, p) {
      const eq = new Tone.EQ3({ low: p.low, mid: p.mid, high: p.high });
      const state = { ...p };
      return {
        audioIn: eq, audioOut: eq, modOut: null, modIns: {}, isSource: false,
        play() {}, stop() {}, setTransport() {},
        update(key, val) {
          state[key] = val;
          if (key === 'low') eq.low.value = val;
          else if (key === 'mid') eq.mid.value = val;
          else if (key === 'high') eq.high.value = val;
        },
        dispose() { eq.dispose(); },
      };
    },
  },

  warp: {
    label: 'Warp',
    category: 'effect',
    accent: ACCENT.effect,
    width: 200,
    inputs: [{ id: 'in', kind: 'audio' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { pitch: 0, mix: 0.4, depth: 0.4 },
    create(ctx, p) {
      const inGain = new Tone.Gain(1);
      const pitch = new Tone.PitchShift({ pitch: p.pitch, wet: 1 });
      const chorus = new Tone.Chorus({ frequency: 0.8, delayTime: 5, depth: p.depth, wet: 1 }).start();
      const wet = new Tone.Gain(p.mix);
      const dry = new Tone.Gain(1 - p.mix);
      const out = new Tone.Gain(1);
      inGain.connect(dry); dry.connect(out);
      inGain.connect(pitch); pitch.connect(chorus); chorus.connect(wet); wet.connect(out);
      const state = { ...p };
      return {
        audioIn: inGain, audioOut: out, modOut: null, modIns: {}, isSource: false,
        play() {}, stop() {}, setTransport() {},
        update(key, val) {
          state[key] = val;
          if (key === 'pitch') pitch.pitch = val;
          else if (key === 'depth') chorus.depth = val;
          else if (key === 'mix') { wet.gain.rampTo(val, 0.1); dry.gain.rampTo(1 - val, 0.1); }
        },
        dispose() { [inGain, pitch, chorus, wet, dry, out].forEach((n) => { try { n.dispose(); } catch (e) {} }); },
      };
    },
  },

  stutter: {
    label: 'Stutter',
    category: 'effect',
    accent: ACCENT.effect,
    width: 200,
    inputs: [{ id: 'in', kind: 'audio' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { rate: '8n', depth: 0.9, mix: 0.7 },
    create(ctx, p) {
      // Rhythmic gate: a transport-locked loop chops the wet signal on/off at a
      // selectable division. depth sets how far the gate closes; mix blends dry.
      const inGain = new Tone.Gain(1);
      const gate = new Tone.Gain(1);
      const wet = new Tone.Gain(p.mix);
      const dry = new Tone.Gain(1 - p.mix);
      const out = new Tone.Gain(1);
      inGain.connect(dry); dry.connect(out);
      inGain.connect(gate); gate.connect(wet); wet.connect(out);
      const state = { ...p };
      let loop = null;
      const buildLoop = () => {
        if (loop) { try { loop.stop(); loop.dispose(); } catch (e) {} }
        loop = new Tone.Loop((time) => {
          const interval = Tone.Time(state.rate).toSeconds();
          const g = gate.gain;
          g.cancelScheduledValues(time);
          g.setValueAtTime(1, time);
          g.setValueAtTime(Math.max(0, 1 - state.depth), time + interval * 0.5);
        }, state.rate).start(0);
      };
      buildLoop();
      return {
        audioIn: inGain, audioOut: out, modOut: null, modIns: {}, isSource: false,
        play() {}, stop() {},
        setTransport(on) { if (!on) { try { gate.gain.cancelScheduledValues(Tone.now()); } catch (e) {} gate.gain.value = 1; } },
        update(key, val) {
          state[key] = val;
          if (key === 'rate') buildLoop();
          else if (key === 'mix') { wet.gain.rampTo(val, 0.1); dry.gain.rampTo(1 - val, 0.1); }
          // depth is read live inside the loop callback
        },
        dispose() { if (loop) { try { loop.stop(); loop.dispose(); } catch (e) {} } [inGain, gate, wet, dry, out].forEach((n) => { try { n.dispose(); } catch (e) {} }); },
      };
    },
  },

  pixelate: {
    label: 'Pixelate',
    category: 'effect',
    accent: ACCENT.effect,
    width: 200,
    inputs: [{ id: 'in', kind: 'audio' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { bits: 4, rate: 4000, mix: 0.6 },
    create(ctx, p) {
      // Bitcrush (bit-depth reduction) + a lowpass that emulates sample-rate
      // downsampling for a lo-fi, "pixelated" texture.
      const inGain = new Tone.Gain(1);
      const crush = new Tone.BitCrusher(p.bits);
      const lp = new Tone.Filter(p.rate, 'lowpass');
      const wet = new Tone.Gain(p.mix);
      const dry = new Tone.Gain(1 - p.mix);
      const out = new Tone.Gain(1);
      inGain.connect(dry); dry.connect(out);
      inGain.connect(crush); crush.connect(lp); lp.connect(wet); wet.connect(out);
      const state = { ...p };
      return {
        audioIn: inGain, audioOut: out, modOut: null, modIns: {}, isSource: false,
        play() {}, stop() {}, setTransport() {},
        update(key, val) {
          state[key] = val;
          if (key === 'bits') { try { crush.bits.value = val; } catch (e) { try { crush.bits = val; } catch (e2) {} } }
          else if (key === 'rate') lp.frequency.rampTo(val, 0.1);
          else if (key === 'mix') { wet.gain.rampTo(val, 0.1); dry.gain.rampTo(1 - val, 0.1); }
        },
        dispose() { [inGain, crush, lp, wet, dry, out].forEach((n) => { try { n.dispose(); } catch (e) {} }); },
      };
    },
  },

  timestretch: {
    label: 'Timestretch',
    category: 'effect',
    accent: ACCENT.effect,
    width: 214,
    inputs: [{ id: 'in', kind: 'audio' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { pitch: 0, window: 0.1, feedback: 0.4, mix: 0.6 },
    create(ctx, p) {
      // Granular pitch/time smear via PitchShift; window + feedback create the
      // characteristic stretched, blurred tail.
      const inGain = new Tone.Gain(1);
      const ps = new Tone.PitchShift({ pitch: p.pitch, windowSize: p.window, feedback: p.feedback, wet: 1 });
      const wet = new Tone.Gain(p.mix);
      const dry = new Tone.Gain(1 - p.mix);
      const out = new Tone.Gain(1);
      inGain.connect(dry); dry.connect(out);
      inGain.connect(ps); ps.connect(wet); wet.connect(out);
      const state = { ...p };
      return {
        audioIn: inGain, audioOut: out, modOut: null, modIns: {}, isSource: false,
        play() {}, stop() {}, setTransport() {},
        update(key, val) {
          state[key] = val;
          if (key === 'pitch') ps.pitch = val;
          else if (key === 'window') ps.windowSize = val;
          else if (key === 'feedback') { try { ps.feedback.rampTo(val, 0.1); } catch (e) { try { ps.feedback.value = val; } catch (e2) {} } }
          else if (key === 'mix') { wet.gain.rampTo(val, 0.1); dry.gain.rampTo(1 - val, 0.1); }
        },
        dispose() { [inGain, ps, wet, dry, out].forEach((n) => { try { n.dispose(); } catch (e) {} }); },
      };
    },
  },

  freeze: {
    label: 'Freeze',
    category: 'effect',
    accent: ACCENT.effect,
    width: 200,
    inputs: [{ id: 'in', kind: 'audio' }],
    outputs: [{ id: 'out', kind: 'audio' }],
    defaults: { hold: 0.9, tone: 2200, mix: 0.6 },
    create(ctx, p) {
      // Spectral-hold-style smear: a very short, very high-feedback delay sustains
      // and blurs the incoming sound into a frozen wash; tone shapes its colour.
      const inGain = new Tone.Gain(1);
      const delay = new Tone.FeedbackDelay({ delayTime: 0.12, feedback: Math.min(0.98, p.hold), wet: 1 });
      const lp = new Tone.Filter(p.tone, 'lowpass');
      const wet = new Tone.Gain(p.mix);
      const dry = new Tone.Gain(1 - p.mix);
      const out = new Tone.Gain(1);
      inGain.connect(dry); dry.connect(out);
      inGain.connect(delay); delay.connect(lp); lp.connect(wet); wet.connect(out);
      const state = { ...p };
      return {
        audioIn: inGain, audioOut: out, modOut: null, modIns: {}, isSource: false,
        play() {}, stop() {}, setTransport() {},
        update(key, val) {
          state[key] = val;
          if (key === 'hold') delay.feedback.rampTo(Math.min(0.98, val), 0.1);
          else if (key === 'tone') lp.frequency.rampTo(val, 0.1);
          else if (key === 'mix') { wet.gain.rampTo(val, 0.1); dry.gain.rampTo(1 - val, 0.1); }
        },
        dispose() { [inGain, delay, lp, wet, dry, out].forEach((n) => { try { n.dispose(); } catch (e) {} }); },
      };
    },
  },
};

export const NODE_CATEGORIES = [
  { id: 'source', label: 'Drone & Texture Sources', types: ['drift', 'grain', 'noise', 'oscillator'] },
  { id: 'sequence', label: 'Sequencing', types: ['noteCycler', 'progression'] },
  { id: 'stream', label: 'Streams', types: ['stream'] },
  { id: 'looper', label: 'Loopers', types: ['looper'] },
  { id: 'mod', label: 'Modulation', types: ['lfo'] },
  { id: 'effect', label: 'Effects', types: ['filter', 'delay', 'reverb', 'eq', 'warp', 'stutter', 'pixelate', 'timestretch', 'freeze'] },
];

export { ACCENT };
