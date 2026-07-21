import { useState, useCallback, useRef } from 'react';
import { graphEngine } from '../engine/graphEngine';
import { NODE_DEFS } from '../engine/nodeDefs';
import { NOTES, CHORD_TYPES, getChordNotes } from '../engine/theory';

let nodeCounter = 0;
let connCounter = 0;

// Ambient-leaning palettes used by the global key + randomiser so results
// stay drone-friendly and musical.
const AMBIENT_CHORDS = ['Root', '5', 'add9', 'maj7', 'min7', 'm11', 'sus2', 'sus4', 'maj9', 'min9'];
const SOFT_WAVES = ['sine', 'triangle', 'sawtooth'];
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const r2 = (v) => +v.toFixed(2);
const clampR = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── Colour → sound mapping ──────────────────────────────────────────────
// Decompose an RGB colour into intuitive mood axes: warm (orange/red) vs cold
// (blue), soft (green), and energy/anger (saturated red). Neutral greys have
// ~zero saturation and produce NO change (the control is a no-op until the user
// picks a real colour).
function colourAxes(colour) {
  const r = (colour?.r ?? 128) / 255, g = (colour?.g ?? 128) / 255, b = (colour?.b ?? 128) / 255;
  const sum = r + g + b || 1;
  const rN = r / sum, gN = g / sum, bN = b / sum;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const sat = max ? (max - min) / max : 0;
  const light = (max + min) / 2;
  const warmAxis = clampR((rN - bN) * 3, -1, 1);            // + warm(orange/red), − cold(blue)
  const softAxis = clampR((gN - (rN + bN) / 2) * 3, 0, 1);  // green → soft
  const energyAxis = clampR((rN - Math.max(gN, bN)) * 2.4 * (0.5 + sat), 0, 1); // saturated red → anger
  return { sat, light, warmAxis, warmPos: Math.max(0, warmAxis), coldAxis: Math.max(0, -warmAxis), softAxis, energyAxis };
}

// Colour → chord quality: cold leans minor, warm leans lush major, green sus,
// saturated red dominant. Only used when the hue is clearly saturated.
function colourChord(m) {
  if (m.coldAxis > 0.35) return m.coldAxis > 0.6 ? 'min9' : 'min7';
  if (m.energyAxis > 0.5) return '7';
  if (m.softAxis > 0.35) return 'sus2';
  if (m.warmPos > 0.4) return 'maj9';
  return 'maj7';
}

// Per-node parameter overrides derived from the global colour. Timbre knobs are
// centred so a mid colour ≈ each node's default; chord/wave "quality" changes
// only kick in for clearly-saturated colours (strongHue).
function colourParams(type, params, colour) {
  const m = colourAxes(colour);
  if (m.sat < 0.12) return {};   // near-grey → no-op
  const soft = m.softAxis, energy = m.energyAxis, cold = m.coldAxis, warm = m.warmPos, warmB = m.warmAxis;
  const strongHue = m.sat >= 0.22;
  const has = (k) => k in params;
  const waveFor = () => (energy > 0.4 ? 'sawtooth' : soft > 0.35 ? 'sine' : 'triangle');
  const chord = colourChord(m);
  switch (type) {
    case 'oscillator': {
      const o = {};
      if (strongHue && has('wave')) o.wave = waveFor();
      if (has('detune')) o.detune = Math.round(energy * 24);
      if (has('attack')) o.attack = r2(clampR(3 + soft * 3 - energy * 2.5, 0.1, 8));
      if (has('release')) o.release = r2(clampR(6 + soft * 4 + warm * 2 - energy * 3, 0.5, 12));
      return o;
    }
    case 'drift':
      return {
        spread: r2(clampR(0.6 + warmB * 0.3, 0.1, 1)),
        motion: r2(clampR(0.18 + energy * 0.5 - soft * 0.1, 0.02, 1.2)),
        attack: r2(clampR(4 + soft * 3 - energy * 2, 0.1, 10)),
        release: r2(clampR(6 + soft * 4 + warm * 2 - energy * 3, 0.5, 16)),
      };
    case 'grain':
      return {
        density: Math.round(clampR(5 + energy * 3, 2, 8)),
        shimmer: r2(clampR(0.4 + cold * 0.4 - warm * 0.15, 0, 1)),
        drift: Math.round(clampR(14 + energy * 20, 0, 50)),
      };
    case 'noise': {
      const o = { cutoff: Math.round(clampR(700 - warmB * 2000 + energy * 800, 150, 6000)), q: r2(clampR(1.4 + energy * 4, 0.2, 10)) };
      if (strongHue) o.color = warmB > 0.25 ? 'brown' : warmB < -0.25 ? 'white' : 'pink';
      return o;
    }
    case 'filter':
      return { cutoff: Math.round(clampR(1200 - warmB * 3000 + energy * 1500, 200, 10000)), resonance: r2(clampR(1.5 + energy * 4.5, 0.1, 10)) };
    case 'delay':
      return { feedback: r2(clampR(0.45 + energy * 0.3, 0.05, 0.9)), wet: r2(clampR(0.4 + soft * 0.15 + cold * 0.1, 0.05, 0.8)) };
    case 'reverb':
      return { decay: r2(clampR(4 + soft * 4 + cold * 3, 0.5, 12)), wet: r2(clampR(0.45 + soft * 0.15 + cold * 0.1 - warm * 0.1, 0.05, 0.85)) };
    case 'eq':
      return { low: Math.round(clampR(warmB * 6, -12, 6)), high: Math.round(clampR(-warmB * 6, -12, 8)), mid: Math.round(clampR(energy * 5, -6, 6)) };
    case 'warp':
      return { depth: r2(clampR(0.4 + energy * 0.3, 0, 1)), mix: r2(clampR(0.35 + energy * 0.25, 0, 1)) };
    case 'arp': {
      const o = {};
      if (strongHue && has('wave')) o.wave = waveFor();
      if (strongHue && has('chord') && params.chord !== chord) o.chord = chord;
      return o;
    }
    case 'noteCycler': {
      const o = { gate: r2(clampR(0.95 - energy * 0.35, 0.2, 1)) };
      if (strongHue && has('wave')) o.wave = waveFor();
      return o;
    }
    case 'synthSeq':
      return { gate: r2(clampR(0.7 - energy * 0.3 + soft * 0.1, 0.1, 1)), noteLength: r2(clampR(0.6 + soft * 1.5 - energy * 0.4, 0.05, 4)) };
    case 'progression': {
      const o = {};
      if (strongHue && has('wave')) o.wave = waveFor();
      if (strongHue && Array.isArray(params.steps) && params.steps.length && !params.steps.every((s) => s.chord === chord)) {
        o.steps = params.steps.map((s) => ({ ...s, chord }));
      }
      return o;
    }
    default:
      return {};
  }
}

// Build a pool of harmonically-relevant notes for a key+chord across a low–mid
// octave range (deduped, sorted low→high). Used to spread tonal sources across
// the harmony — on both key change and randomise — instead of forcing unison.
function harmonicPool(key) {
  const root = key?.root || 'C';
  const chord = (key && CHORD_TYPES[key.chord] && CHORD_TYPES[key.chord].length) ? key.chord : 'add9';
  const seen = new Set();
  const pool = [];
  [2, 3, 4].forEach((o) => getChordNotes(root, o, chord).forEach((n) => { if (!seen.has(n)) { seen.add(n); pool.push(n); } }));
  const midi = (s) => { const m = /^([A-G]#?)(-?\d)$/.exec(s); return m ? NOTES.indexOf(m[1]) + (parseInt(m[2], 10) + 1) * 12 : 0; };
  pool.sort((a, b) => midi(a) - midi(b));
  return pool.length ? pool : ['C3'];
}
// Split a note string like "D#3" into { root, octave } clamped to a sane range.
function splitNote(s) {
  const m = /^([A-G]#?)(-?\d)$/.exec(s) || [null, 'C', '3'];
  return { root: m[1], octave: Math.max(1, Math.min(5, parseInt(m[2], 10))) };
}

// Re-roll a single node's params toward musical, ambient values, constrained
// to the current global key where it matters (so the patch stays in key).
function randomParams(type, key) {
  const root = key?.root || 'C';
  const pool = harmonicPool(key);
  switch (type) {
    case 'oscillator': {
      const n = splitNote(pick(pool));
      return { wave: pick(SOFT_WAVES), root: n.root, octave: n.octave, chord: 'Root', detune: Math.round(rand(-14, 14)), level: r2(rand(0.3, 0.6)), pan: r2(rand(-0.7, 0.7)), attack: r2(rand(1.5, 6)), release: r2(rand(3, 10)) };
    }
    case 'drift': {
      const n = splitNote(pick(pool));
      return { root: n.root, octave: n.octave, chord: 'Root', spread: r2(rand(0.3, 0.9)), motion: r2(rand(0.05, 0.5)), level: r2(rand(0.3, 0.6)), pan: r2(rand(-0.6, 0.6)), attack: r2(rand(2, 7)), release: r2(rand(4, 12)) };
    }
    case 'grain': {
      const n = splitNote(pick(pool));
      return { root: n.root, octave: n.octave, chord: 'Root', density: randInt(3, 7), drift: randInt(6, 30), shimmer: r2(rand(0.2, 0.7)), level: r2(rand(0.25, 0.55)), pan: r2(rand(-0.7, 0.7)) };
    }
    case 'noise':
      return { color: pick(['pink', 'white', 'brown']), cutoff: Math.round(rand(200, 3000)), q: +rand(0.6, 4).toFixed(1), motion: r2(rand(0.03, 0.5)), level: r2(rand(0.2, 0.45)), pan: r2(rand(-0.7, 0.7)) };
    case 'noteCycler': {
      const len = randInt(3, 5);
      const cn = getChordNotes(root, randInt(2, 3), pick(AMBIENT_CHORDS));
      return { notes: Array.from({ length: len }, (_, i) => cn[i % cn.length]), division: pick(['2n', '4n', '4t', '1n']), mode: pick(['up', 'down', 'random']), wave: pick(['sine', 'triangle']), gate: r2(rand(0.6, 1)), level: r2(rand(0.3, 0.55)) };
    }
    case 'progression': {
      const len = randInt(3, 5);
      return { steps: Array.from({ length: len }, () => ({ root, octave: randInt(2, 4), chord: pick(AMBIENT_CHORDS) })), beats: pick([4, 6, 8, 12]), wave: pick(['sine', 'triangle']), level: r2(rand(0.3, 0.55)) };
    }
    case 'lfo':
      return { rate: r2(rand(0.05, 1.2)), depth: r2(rand(0.2, 0.8)), shape: pick(['sine', 'triangle', 'sawtooth', 'square']) };
    case 'filter':
      return { type: pick(['lowpass', 'highpass', 'bandpass']), cutoff: Math.round(rand(300, 6000)), resonance: +rand(0.4, 6).toFixed(1) };
    case 'delay':
      return { time: pick(['8n', '4n', '4t', '2n']), feedback: r2(rand(0.2, 0.6)), wet: r2(rand(0.2, 0.5)) };
    case 'reverb':
      return { decay: +rand(3, 10).toFixed(1), wet: r2(rand(0.3, 0.6)) };
    case 'eq':
      return { low: Math.round(rand(-6, 6)), mid: Math.round(rand(-6, 4)), high: Math.round(rand(-6, 6)) };
    case 'warp':
      return { pitch: randInt(-7, 7), depth: r2(rand(0.2, 0.7)), mix: r2(rand(0.2, 0.6)) };
    case 'stutter':
      return { rate: pick(['16n', '8t', '8n', '4n']), depth: r2(rand(0.5, 1)), mix: r2(rand(0.3, 0.8)) };
    case 'pixelate':
      return { bits: randInt(2, 7), rate: Math.round(rand(1200, 8000)), mix: r2(rand(0.3, 0.7)) };
    case 'timestretch':
      return { pitch: randInt(-7, 7), window: r2(rand(0.05, 0.3)), feedback: r2(rand(0.2, 0.7)), mix: r2(rand(0.3, 0.7)) };
    case 'freeze':
      return { hold: r2(rand(0.7, 0.97)), tone: Math.round(rand(800, 5000)), mix: r2(rand(0.3, 0.7)) };
    default:
      return {};
  }
}

// Single-voice tonal sources voice ONE harmonic note each (so collectively they
// spell the chord across a range), keyed off a stable per-node voice index.
const SINGLE_VOICE = new Set(['oscillator', 'drift', 'grain']);

// Shared in-key derivation used at BOTH node-creation time and global-key
// retune time so a freshly-added source and a live-retuned one stay consistent.
// `voiceIndex` spreads single-voice sources across the harmonic pool (chord
// tones over a low–mid octave range) instead of forcing unison on the root.
// Returns only the params that should change for the given global key; an empty
// object means "leave defaults as-is" (e.g. unpitched noise, or no key).
function keyOverrides(type, params, key, voiceIndex = 0) {
  if (!key || !key.root) return {};
  const { root, chord } = key;
  switch (type) {
    case 'oscillator':
    case 'drift':
    case 'grain': {
      // Pick this voice's note from the harmonic pool so the ensemble voices
      // the chord across a range rather than all sounding the same pitch.
      const pool = harmonicPool(key);
      const note = splitNote(pool[((voiceIndex % pool.length) + pool.length) % pool.length]);
      const o = {};
      if ('root' in params) o.root = note.root;
      if ('chord' in params) o.chord = 'Root';   // each plays a single harmonic tone
      if ('octave' in params) o.octave = note.octave;
      return o;
    }
    case 'noteCycler':
    case 'synthSeq': {
      if (!Array.isArray(params.notes)) return {};
      const len = params.notes.length || 4;
      // Draw the sequence from the full harmonic pool (across octaves) so it
      // steps through harmonically-relevant notes in a range, not one octave.
      const pool = harmonicPool(key);
      return { notes: Array.from({ length: len }, (_, i) => pool[i % pool.length]) };
    }
    case 'arp': {
      const o = {};
      if ('root' in params) o.root = root;
      if ('chord' in params && chord) o.chord = chord;
      return o;
    }
    case 'progression': {
      if (!Array.isArray(params.steps)) return {};
      return { steps: params.steps.map((s) => ({ ...s, root, chord: chord || s.chord })) };
    }
    default:
      return {};
  }
}

export function useGraph() {
  const [initialized, setInitialized] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpmState] = useState(70);
  const [masterVolume, setMasterVolumeState] = useState(0.9);
  const [isRecording, setIsRecording] = useState(false);
  const [recError, setRecError] = useState(null);
  const [globalKey, setGlobalKeyState] = useState({ root: 'C', chord: 'add9' });
  const globalKeyRef = useRef({ root: 'C', chord: 'add9' });
  const [globalColour, setGlobalColourState] = useState({ r: 150, g: 150, b: 150 });
  const globalColourRef = useRef({ r: 150, g: 150, b: 150 });
  const idRef = useRef({});
  const voiceCounterRef = useRef(0);   // monotonic index → stable chord-tone per single-voice node

  const init = useCallback(async () => {
    await graphEngine.init();
    setInitialized(true);
    setPlaying(graphEngine.playing);
  }, []);

  const addNode = useCallback((type, x, y) => {
    const def = NODE_DEFS[type];
    if (!def) return null;
    const id = `n${++nodeCounter}`;
    const params = { ...structuredClone(def.defaults) };
    // Stable per-node voice index lets single-voice tonal sources each take a
    // different chord tone (the ensemble voices the chord, not unison).
    let voiceIndex = 0;
    if (SINGLE_VOICE.has(type)) { voiceIndex = voiceCounterRef.current++; params._voice = voiceIndex; }
    // New source nodes inherit the current global key so they drop in on-key
    // (baked into both the audio handle and the React node state below).
    Object.assign(params, keyOverrides(type, params, globalKeyRef.current, voiceIndex));
    // New nodes also adopt the current colour mood (no-op when colour is grey).
    Object.assign(params, colourParams(type, params, globalColourRef.current));
    graphEngine.addNode(id, type, params);
    const node = { id, type, x, y, params };
    setNodes((prev) => [...prev, node]);
    return id;
  }, []);

  const setNodeEnabled = useCallback((id, on) => {
    const h = graphEngine.getHandle(id);
    try { h?.setEnabled?.(on); } catch (e) {}
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, params: { ...n.params, enabled: on } } : n)));
  }, []);

  const setMute = useCallback((id, on) => {
    graphEngine.setMute(id, on);
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, params: { ...n.params, muted: on } } : n)));
  }, []);

  const setSolo = useCallback((id, on) => {
    graphEngine.setSolo(id, on);
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, params: { ...n.params, soloed: on } } : n)));
  }, []);

  const removeNode = useCallback((id) => {
    graphEngine.removeNode(id);
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setConnections((prev) => prev.filter((c) => c.from.node !== id && c.to.node !== id));
  }, []);

  const moveNode = useCallback((id, x, y) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }, []);

  const updateParam = useCallback((id, key, value) => {
    graphEngine.updateParam(id, key, value);
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, params: { ...n.params, [key]: value } } : n)));
  }, []);

  const addConnection = useCallback((from, to) => {
    const id = `c${++connCounter}`;
    const ok = graphEngine.addConnection(id, from, to);
    if (ok) setConnections((prev) => [...prev, { id, from, to }]);
    return ok;
  }, []);

  const removeConnection = useCallback((id) => {
    graphEngine.removeConnection(id);
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const canConnect = useCallback((from, to) => graphEngine.canConnect(from, to), []);

  // ── Clear everything: dispose all handles, empty the graph + mixer ──
  const clearAll = useCallback(() => {
    graphEngine.clearAll();
    voiceCounterRef.current = 0;
    setNodes([]);
    setConnections([]);
  }, []);

  // ── Global key: retune every source live without dropping the drone ──
  const setGlobalKey = useCallback((next) => {
    globalKeyRef.current = next;
    setGlobalKeyState(next);
    // Running index across single-voice tonal nodes guarantees they spread
    // across the harmonic pool (in creation order), even if some predate the
    // per-node voice index.
    let vi = 0;
    setNodes((prev) => prev.map((n) => {
      const idx = SINGLE_VOICE.has(n.type) ? vi++ : 0;
      const ov = keyOverrides(n.type, n.params, next, idx);
      if (!Object.keys(ov).length) return n;
      Object.entries(ov).forEach(([k, v]) => graphEngine.updateParam(n.id, k, v));
      return { ...n, params: { ...n.params, ...ov } };
    }));
  }, []);

  // ── Global colour: paint a mood across every module live ──
  const setGlobalColour = useCallback((next) => {
    globalColourRef.current = next;
    setGlobalColourState(next);
    setNodes((prev) => prev.map((n) => {
      const ov = colourParams(n.type, n.params, next);
      const changed = {};
      Object.entries(ov).forEach(([k, v]) => {
        const diff = Array.isArray(v) ? true : n.params[k] !== v;
        if (diff) { changed[k] = v; try { graphEngine.updateParam(n.id, k, v); } catch (e) {} }
      });
      if (!Object.keys(changed).length) return n;
      return { ...n, params: { ...n.params, ...changed } };
    }));
  }, []);

  // ── Randomise every node for instant ambient variation ──
  const randomiseAll = useCallback(() => {
    const key = globalKeyRef.current;
    setNodes((prev) => prev.map((n) => {
      const overrides = randomParams(n.type, key);
      const params = { ...n.params };
      Object.entries(overrides).forEach(([k, v]) => { params[k] = v; graphEngine.updateParam(n.id, k, v); });
      return { ...n, params };
    }));
  }, []);

  // ── Transport ──
  const play = useCallback(() => { graphEngine.play(); setPlaying(true); }, []);
  const pause = useCallback(() => { graphEngine.pause(); setPlaying(false); }, []);
  const stop = useCallback(() => { graphEngine.stop(); setPlaying(false); }, []);
  const setBpm = useCallback((b) => { graphEngine.setBpm(b); setBpmState(b); }, []);
  const setMasterVolume = useCallback((v) => { graphEngine.setMasterVolume(v); setMasterVolumeState(v); }, []);

  // ── Recording ──
  const startRecording = useCallback(async () => {
    setRecError(null);
    let res;
    try { res = await graphEngine.startRecording(); }
    catch (e) { console.error('startRecording threw', e); res = { ok: false, error: e?.message || 'Recording failed' }; }
    if (res && res.ok) { setIsRecording(true); }
    else {
      setIsRecording(false);
      const msg = (res && res.error) || 'Recording failed to start';
      setRecError(msg);
      console.error('Record Mix failed:', msg);
    }
  }, []);
  const stopRecording = useCallback(async () => {
    let result = null;
    try { result = await graphEngine.stopRecording(); }
    catch (e) { console.error('stopRecording threw', e); setRecError('Export failed — see console'); }
    setIsRecording(false);
    if (!result || !result.blob) { setRecError('No audio captured — is the transport playing and a source audible?'); return; }
    const { blob, ext, degraded } = result;
    if (degraded) setRecError(`Saved as .${ext} (couldn't transcode to WAV)`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polychromia-${Date.now()}.${ext || 'wav'}`;
    a.click();
    // Defer revoke so large (50MB+) downloads aren't cancelled before they start.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, []);
  const clearRecError = useCallback(() => setRecError(null), []);

  return {
    initialized, init,
    nodes, connections,
    addNode, removeNode, moveNode, updateParam, setNodeEnabled, setMute, setSolo,
    addConnection, removeConnection, canConnect,
    clearAll,
    globalKey, setGlobalKey, randomiseAll,
    globalColour, setGlobalColour,
    playing, play, pause, stop,
    bpm, setBpm,
    masterVolume, setMasterVolume,
    isRecording, startRecording, stopRecording,
    recError, clearRecError,
    getHandle: (id) => graphEngine.getHandle(id),
    engine: graphEngine,
  };
}
