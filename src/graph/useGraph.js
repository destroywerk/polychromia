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

// Re-roll a single node's params toward musical, ambient values, constrained
// to the current global key where it matters (so the patch stays in key).
function randomParams(type, key) {
  const root = key?.root || 'C';
  switch (type) {
    case 'oscillator':
      return { wave: pick(SOFT_WAVES), root, octave: randInt(1, 4), chord: pick(AMBIENT_CHORDS), detune: Math.round(rand(-14, 14)), level: r2(rand(0.3, 0.6)), pan: r2(rand(-0.7, 0.7)), attack: r2(rand(1.5, 6)), release: r2(rand(3, 10)) };
    case 'drift':
      return { root, octave: randInt(1, 3), chord: pick(AMBIENT_CHORDS), spread: r2(rand(0.3, 0.9)), motion: r2(rand(0.05, 0.5)), level: r2(rand(0.3, 0.6)), pan: r2(rand(-0.6, 0.6)), attack: r2(rand(2, 7)), release: r2(rand(4, 12)) };
    case 'grain':
      return { root, octave: randInt(2, 4), chord: pick(AMBIENT_CHORDS), density: randInt(3, 7), drift: randInt(6, 30), shimmer: r2(rand(0.2, 0.7)), level: r2(rand(0.25, 0.55)), pan: r2(rand(-0.7, 0.7)) };
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

// Single-voice tonal sources voice ONE chord tone each (so collectively they
// spell the chord), keyed off a stable per-node voice index.
const SINGLE_VOICE = new Set(['oscillator', 'drift', 'grain']);
const BASE_OCTAVE = { oscillator: 2, drift: 2, grain: 3 };

// Shared in-key derivation used at BOTH node-creation time and global-key
// retune time so a freshly-added source and a live-retuned one stay consistent.
// `voiceIndex` is a stable per-node index used to spread single-voice sources
// across the chord tones / harmonics instead of forcing unison.
// Returns only the params that should change for the given global key; an empty
// object means "leave defaults as-is" (e.g. unpitched noise, or no key).
function keyOverrides(type, params, key, voiceIndex = 0) {
  if (!key || !key.root) return {};
  const { root, chord } = key;
  switch (type) {
    case 'oscillator':
    case 'drift':
    case 'grain': {
      // Assign this voice a single member of the chord (with octave spread when
      // there are more voices than chord tones) so the ensemble voices the chord.
      const intervals = (CHORD_TYPES[chord] && CHORD_TYPES[chord].length) ? CHORD_TYPES[chord] : [0];
      const idx = ((voiceIndex % intervals.length) + intervals.length) % intervals.length;
      const octaveBump = Math.floor(voiceIndex / intervals.length);
      const rootIdx = NOTES.indexOf(root);
      const total = rootIdx + intervals[idx];
      const note = NOTES[((total % 12) + 12) % 12];
      const baseOct = BASE_OCTAVE[type] ?? 2;
      const octave = Math.max(1, Math.min(5, baseOct + Math.floor(total / 12) + octaveBump));
      const o = {};
      if ('root' in params) o.root = note;
      if ('chord' in params) o.chord = 'Root';   // each plays a single chord tone
      if ('octave' in params) o.octave = octave;
      return o;
    }
    case 'noteCycler':
    case 'synthSeq': {
      if (!Array.isArray(params.notes)) return {};
      const len = params.notes.length || 4;
      const cn = getChordNotes(root, 3, chord || 'add9');
      return { notes: Array.from({ length: len }, (_, i) => cn[i % cn.length]) };
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
    setNodes((prev) => prev.map((n) => {
      const ov = keyOverrides(n.type, n.params, next, n.params._voice ?? 0);
      if (!Object.keys(ov).length) return n;
      Object.entries(ov).forEach(([k, v]) => graphEngine.updateParam(n.id, k, v));
      return { ...n, params: { ...n.params, ...ov } };
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
    if (!result || !result.blob) { setRecError('No audio was captured'); return; }
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
    playing, play, pause, stop,
    bpm, setBpm,
    masterVolume, setMasterVolume,
    isRecording, startRecording, stopRecording,
    recError, clearRecError,
    getHandle: (id) => graphEngine.getHandle(id),
    engine: graphEngine,
  };
}
