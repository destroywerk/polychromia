import React, { useState, useEffect, useRef } from 'react';
import { Knob, Segmented, MiniSlider, Stepper } from '../ui/Controls';
import { NOTES, CHORD_TYPES } from '../../engine/theory';
import { SYNTH_PRESETS, PIANO_PRESETS } from '../../engine/nodeDefs';
import { searchStations, AMBIENT_GENRES } from '../../utils/radioApi';

const WAVES = [
  { value: 'sine', label: 'sin' },
  { value: 'triangle', label: 'tri' },
  { value: 'sawtooth', label: 'saw' },
  { value: 'square', label: 'sqr' },
  { value: 'fm', label: 'fm' },
  { value: 'am', label: 'am' },
];
const OCTAVES = [1, 2, 3, 4, 5, 6];
const CHORD_KEYS = Object.keys(CHORD_TYPES);
const DIVISIONS = ['16n', '8t', '8n', '4n', '4t', '2n', '1n'];

const fHz = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);
const fPct = (v) => `${Math.round(v * 100)}`;
const fDb = (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`;
const fSec = (v) => `${v.toFixed(1)}s`;

function Row({ children }) { return <div className="flex items-center justify-between gap-2">{children}</div>; }
function KnobRow({ children }) { return <div className="flex justify-around gap-1 pt-1">{children}</div>; }
function LabeledStepper({ label, ...props }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="ui-label text-[9px]">{label}</span>
      <Stepper {...props} />
    </div>
  );
}

export function NodeBody({ node, def, update, handle }) {
  const p = node.params;
  const a = def.accent;

  switch (node.type) {
    case 'oscillator':
      return (
        <div className="space-y-2.5">
          <Segmented options={WAVES} value={p.wave} onChange={(v) => update('wave', v)} accent={a} />
          <Row>
            <LabeledStepper label="note" value={p.root} onChange={(v) => update('root', v)} options={NOTES} accent={a} />
            <LabeledStepper label="oct" value={p.octave} onChange={(v) => update('octave', v)} options={OCTAVES} accent={a} />
            <LabeledStepper label="chord" value={p.chord} onChange={(v) => update('chord', v)} options={CHORD_KEYS} accent={a} wide />
          </Row>
          <KnobRow>
            <Knob value={p.attack} min={0.01} max={8} onChange={(v) => update('attack', v)} label="att" accent={a} format={fSec} />
            <Knob value={p.release} min={0.1} max={12} onChange={(v) => update('release', v)} label="rel" accent={a} format={fSec} />
            <Knob value={p.detune} min={-50} max={50} step={1} onChange={(v) => update('detune', v)} label="detune" accent={a} format={(v) => `${Math.round(v)}`} />
            <Knob value={p.level} min={0} max={1} onChange={(v) => update('level', v)} label="lvl" accent={a} format={fPct} />
          </KnobRow>
        </div>
      );

    case 'drift':
      return (
        <div className="space-y-2.5">
          <Row>
            <LabeledStepper label="note" value={p.root} onChange={(v) => update('root', v)} options={NOTES} accent={a} />
            <LabeledStepper label="oct" value={p.octave} onChange={(v) => update('octave', v)} options={OCTAVES} accent={a} />
            <LabeledStepper label="chord" value={p.chord} onChange={(v) => update('chord', v)} options={CHORD_KEYS} accent={a} wide />
          </Row>
          <KnobRow>
            <Knob value={p.spread} min={0} max={1} onChange={(v) => update('spread', v)} label="width" accent={a} format={fPct} />
            <Knob value={p.motion} min={0.01} max={2} onChange={(v) => update('motion', v)} label="drift" accent={a} format={(v) => `${v.toFixed(2)}`} />
            <Knob value={p.attack} min={0.1} max={10} onChange={(v) => update('attack', v)} label="att" accent={a} format={fSec} />
            <Knob value={p.release} min={0.5} max={16} onChange={(v) => update('release', v)} label="rel" accent={a} format={fSec} />
            <Knob value={p.level} min={0} max={1} onChange={(v) => update('level', v)} label="lvl" accent={a} format={fPct} />
          </KnobRow>
        </div>
      );

    case 'grain':
      return (
        <div className="space-y-2.5">
          <Row>
            <LabeledStepper label="note" value={p.root} onChange={(v) => update('root', v)} options={NOTES} accent={a} />
            <LabeledStepper label="oct" value={p.octave} onChange={(v) => update('octave', v)} options={OCTAVES} accent={a} />
            <LabeledStepper label="chord" value={p.chord} onChange={(v) => update('chord', v)} options={CHORD_KEYS} accent={a} wide />
          </Row>
          <KnobRow>
            <Knob value={p.density} min={2} max={8} step={1} onChange={(v) => update('density', v)} label="grains" accent={a} format={(v) => `${Math.round(v)}`} />
            <Knob value={p.drift} min={0} max={50} step={1} onChange={(v) => update('drift', v)} label="drift" accent={a} format={(v) => `${Math.round(v)}`} />
            <Knob value={p.shimmer} min={0} max={1} onChange={(v) => update('shimmer', v)} label="shimmer" accent={a} format={fPct} />
            <Knob value={p.level} min={0} max={1} onChange={(v) => update('level', v)} label="lvl" accent={a} format={fPct} />
          </KnobRow>
        </div>
      );

    case 'noise':
      return (
        <div className="space-y-2">
          <Segmented options={[{ value: 'pink', label: 'pink' }, { value: 'white', label: 'white' }, { value: 'brown', label: 'brown' }]} value={p.color} onChange={(v) => update('color', v)} accent={a} />
          <KnobRow>
            <Knob value={p.cutoff} min={80} max={8000} step={10} onChange={(v) => update('cutoff', v)} label="color" accent={a} format={fHz} />
            <Knob value={p.q} min={0.2} max={12} step={0.1} onChange={(v) => update('q', v)} label="focus" accent={a} format={(v) => v.toFixed(1)} />
            <Knob value={p.motion} min={0.01} max={2} onChange={(v) => update('motion', v)} label="motion" accent={a} format={(v) => `${v.toFixed(2)}`} />
            <Knob value={p.level} min={0} max={1} onChange={(v) => update('level', v)} label="lvl" accent={a} format={fPct} />
          </KnobRow>
        </div>
      );

    case 'sampler':
      return <SamplerBody p={p} a={a} update={update} handle={handle} />;

    case 'piano':
      return <PianoBody p={p} a={a} update={update} handle={handle} />;

    case 'noteCycler':
      return <NoteCyclerBody p={p} a={a} update={update} handle={handle} />;

    case 'synthSeq':
      return <SynthSeqBody p={p} a={a} update={update} handle={handle} />;

    case 'arp':
      return <ArpBody p={p} a={a} update={update} handle={handle} />;

    case 'progression':
      return <ProgressionBody p={p} a={a} update={update} handle={handle} />;

    case 'stream':
      return <StreamBody p={p} a={a} update={update} handle={handle} />;

    case 'looper':
      return <LooperBody p={p} a={a} update={update} handle={handle} />;

    case 'lfo':
      return (
        <div className="space-y-2">
          <Segmented options={[{ value: 'sine', label: 'sin' }, { value: 'triangle', label: 'tri' }, { value: 'sawtooth', label: 'saw' }, { value: 'square', label: 'sqr' }]} value={p.shape} onChange={(v) => update('shape', v)} accent={a} />
          <KnobRow>
            <Knob value={p.rate} min={0.05} max={8} onChange={(v) => update('rate', v)} label="rate" accent={a} format={(v) => `${v.toFixed(2)}Hz`} />
            <Knob value={p.depth} min={0} max={1} onChange={(v) => update('depth', v)} label="depth" accent={a} format={fPct} />
          </KnobRow>
        </div>
      );

    case 'volume':
      return (
        <KnobRow>
          <Knob value={p.level} min={0} max={1.5} onChange={(v) => update('level', v)} label="level" accent={a} format={fPct} />
          <Knob value={p.pan} min={-1} max={1} onChange={(v) => update('pan', v)} label="pan" accent={a} format={(v) => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)} />
        </KnobRow>
      );

    case 'filter':
      return (
        <div className="space-y-2">
          <Segmented options={[{ value: 'lowpass', label: 'LP' }, { value: 'highpass', label: 'HP' }, { value: 'bandpass', label: 'BP' }]} value={p.type} onChange={(v) => update('type', v)} accent={a} />
          <KnobRow>
            <Knob value={p.cutoff} min={40} max={12000} step={10} onChange={(v) => update('cutoff', v)} label="cutoff" accent={a} format={fHz} />
            <Knob value={p.resonance} min={0.1} max={12} step={0.1} onChange={(v) => update('resonance', v)} label="reso" accent={a} format={(v) => v.toFixed(1)} />
          </KnobRow>
        </div>
      );

    case 'delay':
      return (
        <div className="space-y-2">
          <Row>
            <span className="ui-label text-[9px]">time</span>
            <Stepper value={p.time} onChange={(v) => update('time', v)} options={DIVISIONS} accent={a} />
          </Row>
          <KnobRow>
            <Knob value={p.feedback} min={0} max={0.95} onChange={(v) => update('feedback', v)} label="fdbk" accent={a} format={fPct} />
            <Knob value={p.wet} min={0} max={1} onChange={(v) => update('wet', v)} label="mix" accent={a} format={fPct} />
          </KnobRow>
        </div>
      );

    case 'reverb':
      return (
        <KnobRow>
          <Knob value={p.decay} min={0.3} max={12} step={0.1} onChange={(v) => update('decay', v)} label="decay" accent={a} format={fSec} />
          <Knob value={p.wet} min={0} max={1} onChange={(v) => update('wet', v)} label="mix" accent={a} format={fPct} />
        </KnobRow>
      );

    case 'eq':
      return (
        <KnobRow>
          <Knob value={p.low} min={-24} max={12} step={1} onChange={(v) => update('low', v)} label="low" accent={a} format={fDb} />
          <Knob value={p.mid} min={-24} max={12} step={1} onChange={(v) => update('mid', v)} label="mid" accent={a} format={fDb} />
          <Knob value={p.high} min={-24} max={12} step={1} onChange={(v) => update('high', v)} label="high" accent={a} format={fDb} />
        </KnobRow>
      );

    case 'warp':
      return (
        <KnobRow>
          <Knob value={p.pitch} min={-12} max={12} step={1} onChange={(v) => update('pitch', v)} label="pitch" accent={a} format={(v) => `${v > 0 ? '+' : ''}${v}`} />
          <Knob value={p.depth} min={0} max={1} onChange={(v) => update('depth', v)} label="warp" accent={a} format={fPct} />
          <Knob value={p.mix} min={0} max={1} onChange={(v) => update('mix', v)} label="mix" accent={a} format={fPct} />
        </KnobRow>
      );

    case 'stutter':
      return (
        <div className="space-y-2">
          <Row>
            <span className="ui-label text-[9px]">rate</span>
            <Stepper value={p.rate} onChange={(v) => update('rate', v)} options={DIVISIONS} accent={a} />
          </Row>
          <KnobRow>
            <Knob value={p.depth} min={0} max={1} onChange={(v) => update('depth', v)} label="depth" accent={a} format={fPct} />
            <Knob value={p.mix} min={0} max={1} onChange={(v) => update('mix', v)} label="mix" accent={a} format={fPct} />
          </KnobRow>
        </div>
      );

    case 'pixelate':
      return (
        <KnobRow>
          <Knob value={p.bits} min={1} max={8} step={1} onChange={(v) => update('bits', v)} label="bits" accent={a} format={(v) => `${Math.round(v)}`} />
          <Knob value={p.rate} min={400} max={12000} step={10} onChange={(v) => update('rate', v)} label="rate" accent={a} format={fHz} />
          <Knob value={p.mix} min={0} max={1} onChange={(v) => update('mix', v)} label="mix" accent={a} format={fPct} />
        </KnobRow>
      );

    case 'timestretch':
      return (
        <KnobRow>
          <Knob value={p.pitch} min={-12} max={12} step={1} onChange={(v) => update('pitch', v)} label="pitch" accent={a} format={(v) => `${v > 0 ? '+' : ''}${v}`} />
          <Knob value={p.window} min={0.03} max={0.5} onChange={(v) => update('window', v)} label="size" accent={a} format={(v) => `${Math.round(v * 1000)}`} />
          <Knob value={p.feedback} min={0} max={0.9} onChange={(v) => update('feedback', v)} label="fdbk" accent={a} format={fPct} />
          <Knob value={p.mix} min={0} max={1} onChange={(v) => update('mix', v)} label="mix" accent={a} format={fPct} />
        </KnobRow>
      );

    case 'freeze':
      return (
        <KnobRow>
          <Knob value={p.hold} min={0} max={0.98} onChange={(v) => update('hold', v)} label="hold" accent={a} format={fPct} />
          <Knob value={p.tone} min={200} max={10000} step={10} onChange={(v) => update('tone', v)} label="tone" accent={a} format={fHz} />
          <Knob value={p.mix} min={0} max={1} onChange={(v) => update('mix', v)} label="mix" accent={a} format={fPct} />
        </KnobRow>
      );

    case 'harmonizer':
      return (
        <KnobRow>
          <Knob value={p.voices} min={1} max={4} step={1} onChange={(v) => update('voices', v)} label="voices" accent={a} format={(v) => `${Math.round(v)}`} />
          <Knob value={p.interval} min={1} max={12} step={1} onChange={(v) => update('interval', v)} label="interval" accent={a} format={(v) => `${Math.round(v)}`} />
          <Knob value={p.detune} min={0} max={30} step={1} onChange={(v) => update('detune', v)} label="detune" accent={a} format={(v) => `${Math.round(v)}`} />
          <Knob value={p.mix} min={0} max={1} onChange={(v) => update('mix', v)} label="mix" accent={a} format={fPct} />
        </KnobRow>
      );

    default:
      return null;
  }
}

// ── Sampler ──
function SamplerBody({ p, a, update, handle }) {
  const fileRef = useRef(null);
  const [name, setName] = useState(p.fileName || '');
  const [dur, setDur] = useState(0);
  useEffect(() => {
    if (!handle) return;
    handle.onLoaded = (fname, d) => { setName(fname || ''); setDur(d || 0); };
    return () => { if (handle) handle.onLoaded = null; };
  }, [handle]);

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    update('fileName', file.name);
    if (handle && handle.loadFile) handle.loadFile(file);
  };

  return (
    <div className="space-y-2.5">
      <input ref={fileRef} type="file" accept="audio/wav,audio/mpeg,audio/ogg,audio/mp4,audio/x-m4a,.wav,.mp3,.ogg,.m4a" className="hidden" onChange={onFile} />
      <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
        className="ui-value w-full py-2 rounded-lg text-[10px] transition-all"
        style={{ background: `${a}1f`, border: `0.5px solid ${a}`, color: a }}>
        {name ? '↺ Replace file' : '⤓ Load audio file'}
      </button>
      <div className="ui-label text-[9px] truncate">{name ? `${name}${dur ? ` · ${dur.toFixed(1)}s` : ''}` : 'wav · mp3 · ogg · m4a'}</div>
      <Row>
        <button onClick={(e) => { e.stopPropagation(); update('loop', !p.loop); }}
          className={`ui-value px-2 py-1 rounded-lg text-[9px] transition-all ${p.loop ? '' : 'ctl ctl-acc'}`}
          style={p.loop ? { background: `${a}22`, border: `0.5px solid ${a}`, color: a } : { '--acc': a, color: '#ffffff' }}>
          ↻ loop
        </button>
        <Knob value={p.rate} min={0.25} max={2} onChange={(v) => update('rate', v)} label="speed" accent={a} format={(v) => `${v.toFixed(2)}x`} />
        <Knob value={p.offset} min={0} max={0.99} onChange={(v) => update('offset', v)} label="start" accent={a} format={fPct} />
        <Knob value={p.level} min={0} max={1} onChange={(v) => update('level', v)} label="lvl" accent={a} format={fPct} />
      </Row>
    </div>
  );
}

// ── Piano (playable keyboard instrument) ──
const WHITE_PATTERN = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_AFTER_LOCAL = new Set([0, 1, 3, 4, 5]); // C D _ F G A (sharps)

// Classic DAW laptop-keyboard → semitone-offset map (relative to base octave).
const KEY_SEMITONES = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16,
};
const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function noteFromSemitone(baseOct, semi) {
  const idx = ((baseOct * 12) + semi);
  return `${CHROMATIC[idx % 12]}${Math.floor(idx / 12)}`;
}

function PianoBody({ p, a, update, handle }) {
  const [active, setActive] = useState(() => new Set());
  const [kbd, setKbd] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const heldKeys = useRef(new Set());

  const press = (note) => {
    if (!handle) return;
    handle.noteOn?.(note);
    setActive((s) => { const n = new Set(s); n.add(note); return n; });
  };
  const release = (note) => {
    if (!activeRef.current.has(note)) return;
    handle?.noteOff?.(note);
    setActive((s) => { const n = new Set(s); n.delete(note); return n; });
  };
  const releaseAll = () => {
    if (handle) activeRef.current.forEach((n) => handle.noteOff?.(n));
    heldKeys.current.clear();
    setActive(new Set());
  };
  // Release any held notes on unmount so nothing sticks.
  useEffect(() => () => { if (handle) activeRef.current.forEach((n) => handle.noteOff?.(n)); }, [handle]);

  // Two octaves from the selected base octave.
  const baseOct = p.octave ?? 4;

  // Window-level laptop-keyboard playing, active only while the toggle is on.
  // Read the latest octave via a ref so octave changes apply live.
  const octRef = useRef(baseOct);
  octRef.current = baseOct;
  useEffect(() => {
    if (!kbd) return undefined;
    const isTyping = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };
    const down = (e) => {
      const k = e.key.toLowerCase();
      if (!(k in KEY_SEMITONES)) return;
      if (isTyping()) return;
      e.preventDefault();
      if (e.repeat || heldKeys.current.has(k)) return;
      heldKeys.current.add(k);
      press(noteFromSemitone(octRef.current, KEY_SEMITONES[k]));
    };
    const up = (e) => {
      const k = e.key.toLowerCase();
      if (!(k in KEY_SEMITONES)) return;
      if (isTyping()) return;
      e.preventDefault();
      if (!heldKeys.current.has(k)) return;
      heldKeys.current.delete(k);
      release(noteFromSemitone(octRef.current, KEY_SEMITONES[k]));
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      releaseAll();
    };
  }, [kbd, handle]);

  const whiteDefs = [];
  for (let o = 0; o < 2; o++) WHITE_PATTERN.forEach((n) => whiteDefs.push({ n, oct: baseOct + o }));
  const whiteW = 100 / whiteDefs.length;
  const blackDefs = [];
  whiteDefs.forEach((w, wi) => {
    if (BLACK_AFTER_LOCAL.has(wi % 7) && wi < whiteDefs.length - 1) {
      blackDefs.push({ n: `${w.n}#`, oct: w.oct, leftPct: (wi + 1) * whiteW });
    }
  });

  const keyH = 76;
  const keyHandlers = (note) => ({
    onPointerDown: (e) => { e.stopPropagation(); press(note); },
    onPointerUp: (e) => { e.stopPropagation(); release(note); },
    onPointerLeave: () => release(note),
  });

  return (
    <div className="space-y-2.5">
      <Row>
        <LabeledStepper label="voice" value={p.preset} onChange={(v) => update('preset', v)} options={PIANO_PRESETS} accent={a} wide />
        <LabeledStepper label="oct" value={p.octave} onChange={(v) => update('octave', v)} options={[2, 3, 4, 5, 6]} accent={a} />
        <Knob value={p.level} min={0} max={1} onChange={(v) => update('level', v)} label="lvl" accent={a} format={fPct} />
        <Knob value={p.sustain} min={0.1} max={8} onChange={(v) => update('sustain', v)} label="sustain" accent={a} format={fSec} />
      </Row>
      <Row>
        <button onClick={(e) => { e.stopPropagation(); setKbd((v) => !v); }}
          className={`ui-value px-2 py-1 rounded-lg text-[9px] transition-all ${kbd ? '' : 'ctl ctl-acc'}`}
          style={kbd ? { background: `${a}22`, border: `0.5px solid ${a}`, color: a } : { '--acc': a, color: '#ffffff' }}>
          ⌨ keyboard {kbd ? 'on' : 'off'}
        </button>
      </Row>
      <div className="relative select-none" style={{ height: keyH }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="absolute inset-0 flex gap-[2px]">
          {whiteDefs.map((w) => {
            const note = `${w.n}${w.oct}`;
            const on = active.has(note);
            return (
              <button key={note} {...keyHandlers(note)}
                className="flex-1 rounded-b transition-colors"
                style={{ background: on ? a : '#e8e8ea', border: '0.5px solid #0b0b0d' }} />
            );
          })}
        </div>
        {blackDefs.map((b) => {
          const note = `${b.n}${b.oct}`;
          const on = active.has(note);
          return (
            <button key={note} {...keyHandlers(note)}
              className="absolute top-0 rounded-b z-10 transition-colors"
              style={{ left: `${b.leftPct}%`, transform: 'translateX(-50%)', width: `${whiteW * 0.62}%`, height: keyH * 0.62, background: on ? a : '#161619', border: '0.5px solid #0b0b0d' }} />
          );
        })}
      </div>
    </div>
  );
}

// ── Synth Sequencer (selectable preset voice) ──
function SynthSeqBody({ p, a, update, handle }) {
  const [root, setRoot] = useState('C');
  const [oct, setOct] = useState(3);
  const addNote = () => update('notes', [...p.notes, `${root}${oct}`]);
  const removeNote = (i) => update('notes', p.notes.filter((_, idx) => idx !== i));
  const presetOpts = SYNTH_PRESETS.map((v) => ({ value: v, label: v }));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {p.notes.map((n, i) => (
          <button key={i} onClick={(e) => { e.stopPropagation(); removeNote(i); }}
            className="px-1.5 py-0.5 rounded text-[9px] font-cal" style={{ background: `${a}22`, color: a }}>
            {n} ×
          </button>
        ))}
      </div>
      <Row>
        <Stepper value={root} onChange={setRoot} options={NOTES} accent={a} />
        <Stepper value={oct} onChange={setOct} options={OCTAVES} accent={a} />
        <button onClick={(e) => { e.stopPropagation(); addNote(); }} className="ctl ui-value px-2 py-0.5 rounded-lg text-[9px]">+ add</button>
      </Row>
      <div className="flex flex-col gap-0.5">
        <span className="ui-label text-[9px]">voice</span>
        <Segmented options={presetOpts} value={p.preset} onChange={(v) => update('preset', v)} accent={a} />
      </div>
      <Row>
        <Segmented options={[{ value: 'up', label: 'up' }, { value: 'down', label: 'dn' }, { value: 'random', label: 'rnd' }]} value={p.mode} onChange={(v) => update('mode', v)} accent={a} />
        <Stepper value={p.division} onChange={(v) => update('division', v)} options={DIVISIONS} accent={a} />
      </Row>
      <KnobRow>
        <Knob value={p.noteLength} min={0.05} max={4} onChange={(v) => update('noteLength', v)} label="length" accent={a} format={fSec} />
        <Knob value={p.gate} min={0.1} max={1} onChange={(v) => update('gate', v)} label="gate" accent={a} format={fPct} />
        <Knob value={p.level} min={0} max={1} onChange={(v) => update('level', v)} label="lvl" accent={a} format={fPct} />
      </KnobRow>
    </div>
  );
}

// ── Arpeggiator ──
function ArpBody({ p, a, update, handle }) {
  const PATTERNS = [{ value: 'up', label: 'up' }, { value: 'down', label: 'dn' }, { value: 'updown', label: 'u/d' }, { value: 'random', label: 'rnd' }];
  return (
    <div className="space-y-2">
      <Row>
        <LabeledStepper label="note" value={p.root} onChange={(v) => update('root', v)} options={NOTES} accent={a} />
        <LabeledStepper label="oct" value={p.octave} onChange={(v) => update('octave', v)} options={OCTAVES} accent={a} />
        <LabeledStepper label="chord" value={p.chord} onChange={(v) => update('chord', v)} options={CHORD_KEYS} accent={a} wide />
      </Row>
      <Row>
        <Segmented options={PATTERNS} value={p.pattern} onChange={(v) => update('pattern', v)} accent={a} />
        <Stepper value={p.rate} onChange={(v) => update('rate', v)} options={DIVISIONS} accent={a} />
      </Row>
      <Segmented options={WAVES} value={p.wave} onChange={(v) => update('wave', v)} accent={a} />
      <KnobRow>
        <Knob value={p.octaves} min={1} max={4} step={1} onChange={(v) => update('octaves', v)} label="range" accent={a} format={(v) => `${Math.round(v)}`} />
        <Knob value={p.gate} min={0.1} max={1} onChange={(v) => update('gate', v)} label="gate" accent={a} format={fPct} />
        <Knob value={p.level} min={0} max={1} onChange={(v) => update('level', v)} label="lvl" accent={a} format={fPct} />
      </KnobRow>
    </div>
  );
}

// ── Sequencer (internal type key: noteCycler) ──
function NoteCyclerBody({ p, a, update, handle }) {
  const [root, setRoot] = useState('C');
  const [oct, setOct] = useState(4);
  const addNote = () => update('notes', [...p.notes, `${root}${oct}`]);
  const removeNote = (i) => update('notes', p.notes.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {p.notes.map((n, i) => (
          <button key={i} onClick={(e) => { e.stopPropagation(); removeNote(i); }}
            className="px-1.5 py-0.5 rounded text-[9px] font-cal" style={{ background: `${a}22`, color: a }}>
            {n} ×
          </button>
        ))}
      </div>
      <Row>
        <Stepper value={root} onChange={setRoot} options={NOTES} accent={a} />
        <Stepper value={oct} onChange={setOct} options={OCTAVES} accent={a} />
        <button onClick={(e) => { e.stopPropagation(); addNote(); }} className="ctl ui-value px-2 py-0.5 rounded-lg text-[9px]">+ add</button>
      </Row>
      <Row>
        <Segmented options={[{ value: 'up', label: 'up' }, { value: 'down', label: 'dn' }, { value: 'random', label: 'rnd' }]} value={p.mode} onChange={(v) => update('mode', v)} accent={a} />
        <Stepper value={p.division} onChange={(v) => update('division', v)} options={DIVISIONS} accent={a} />
      </Row>
      <Segmented options={WAVES} value={p.wave} onChange={(v) => update('wave', v)} accent={a} />
      <KnobRow>
        <Knob value={p.gate} min={0.1} max={1} onChange={(v) => update('gate', v)} label="gate" accent={a} format={fPct} />
        <Knob value={p.level} min={0} max={1} onChange={(v) => update('level', v)} label="lvl" accent={a} format={fPct} />
      </KnobRow>
    </div>
  );
}

// ── Progression ──
function ProgressionBody({ p, a, update, handle }) {
  const [active, setActive] = useState(0);
  useEffect(() => { if (handle) handle.onStep = (i) => setActive(i); return () => { if (handle) handle.onStep = null; }; }, [handle]);

  const setStep = (i, key, val) => {
    const steps = p.steps.map((s, idx) => (idx === i ? { ...s, [key]: val } : s));
    update('steps', steps);
  };
  const addStep = () => update('steps', [...p.steps, { root: 'C', octave: 3, chord: 'maj7' }]);
  const removeStep = (i) => update('steps', p.steps.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {p.steps.map((s, i) => (
          <div key={i} className="flex items-center gap-1 rounded px-1 py-0.5"
            style={{ background: active === i ? `${a}1a` : 'transparent', border: `1px solid ${active === i ? `${a}44` : 'transparent'}` }}>
            <Stepper value={s.root} onChange={(v) => setStep(i, 'root', v)} options={NOTES} accent={a} />
            <Stepper value={s.octave} onChange={(v) => setStep(i, 'octave', v)} options={OCTAVES} accent={a} />
            <Stepper value={s.chord} onChange={(v) => setStep(i, 'chord', v)} options={Object.keys(CHORD_TYPES)} accent={a} wide />
            <button onClick={(e) => { e.stopPropagation(); removeStep(i); }} className="text-white/20 hover:text-rose-400 text-sm px-1">×</button>
          </div>
        ))}
      </div>
      <Row>
        <button onClick={(e) => { e.stopPropagation(); addStep(); }} className="ctl ui-value px-2 py-0.5 rounded-lg text-[9px]">+ chord</button>
        <div className="flex items-center gap-1">
          <span className="ui-label text-[9px]">beats</span>
          <Stepper value={p.beats} onChange={(v) => update('beats', v)} options={[2, 4, 6, 8, 12, 16]} accent={a} />
        </div>
      </Row>
      <Segmented options={WAVES} value={p.wave} onChange={(v) => update('wave', v)} accent={a} />
      <Knob value={p.level} min={0} max={1} onChange={(v) => update('level', v)} label="lvl" accent={a} format={fPct} />
    </div>
  );
}

// ── Stream ──
function StreamBody({ p, a, update, handle }) {
  const [genre, setGenre] = useState('world');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(!p.url);

  const load = async (g) => {
    setLoading(true);
    try { setResults(await searchStations({ genre: g, limit: 12 })); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open && results.length === 0) load(genre); }, [open]);

  const pick = (st) => {
    const url = st.url_resolved || st.url;
    update('stationName', st.name);
    update('url', url);
    setOpen(false);
    setTimeout(() => { handle?.play(); setPlaying(true); }, 100);
  };
  const toggle = () => {
    if (!handle) return;
    if (playing) { handle.stop(); setPlaying(false); }
    else { handle.play(); setPlaying(true); }
  };

  return (
    <div className="space-y-2">
      {p.stationName ? (
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); toggle(); }}
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ border: `1px solid ${playing ? a : '#444'}`, background: playing ? `${a}22` : 'transparent', color: a }}>
            <span className="text-[8px]">{playing ? '■' : '▶'}</span>
          </button>
          <div className="flex-1 min-w-0">
            <div className="ui-value text-[11px] truncate">{p.stationName}</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} className="ui-label text-[9px] hover:text-white">change</button>
        </div>
      ) : (
        <div className="ui-label text-[10px]">Pick a station below</div>
      )}

      {open && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
            {AMBIENT_GENRES.slice(0, 12).map((g) => (
              <button key={g} onClick={(e) => { e.stopPropagation(); setGenre(g); load(g); }}
                className="ui-value text-[8px] px-1.5 py-0.5 rounded-full transition-colors"
                style={{ border: `0.5px solid ${genre === g ? a : 'transparent'}`, color: genre === g ? a : 'rgba(255,255,255,0.8)' }}>
                {g}
              </button>
            ))}
          </div>
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {loading ? <div className="ui-label text-[10px] py-2 text-center">loading…</div>
              : results.map((st) => (
                <button key={st.stationuuid} onClick={(e) => { e.stopPropagation(); pick(st); }}
                  className="block w-full text-left px-1.5 py-1 rounded hover:bg-white/5">
                  <div className="ui-value text-[10px] truncate">{st.name}</div>
                  <div className="ui-label text-[8px] truncate">{st.country}</div>
                </button>
              ))}
          </div>
        </div>
      )}
      <Knob value={p.level} min={0} max={1} onChange={(v) => update('level', v)} label="lvl" accent={a} format={fPct} />
    </div>
  );
}

// Draws a recorded loop's waveform on a canvas with draggable start/end handles
// that set the playback region (fractions 0..1) used by the engine loop points.
function WaveformEditor({ p, a, update, handle }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const dragRef = useRef(null);

  const draw = (buf) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    if (!buf) return;
    const data = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / W));
    ctx.strokeStyle = `${a}99`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      let min = 1, max = -1;
      for (let i = 0; i < step; i++) {
        const v = data[x * step + i] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const y1 = (1 - (max + 1) / 2) * H;
      const y2 = (1 - (min + 1) / 2) * H;
      ctx.moveTo(x + 0.5, y1);
      ctx.lineTo(x + 0.5, y2);
    }
    ctx.stroke();
  };

  useEffect(() => {
    if (!handle) return;
    const refresh = () => draw(handle.getBuffer && handle.getBuffer());
    handle.onBuffer = () => refresh();
    refresh();
    return () => { if (handle) handle.onBuffer = null; };
  }, [handle, a]);

  const fracFromEvent = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };
  const onDown = (which) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = which;
    const move = (ev) => {
      const f = fracFromEvent(ev);
      if (dragRef.current === 'start') update('loopStart', Math.min(f, (p.loopEnd ?? 1) - 0.02));
      else update('loopEnd', Math.max(f, (p.loopStart ?? 0) + 0.02));
    };
    const up = () => { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const s = (p.loopStart ?? 0) * 100;
  const e = (p.loopEnd ?? 1) * 100;
  return (
    <div ref={wrapRef} className="relative h-12 rounded overflow-hidden select-none"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #2a2a30' }}>
      <canvas ref={canvasRef} width={206} height={48} className="absolute inset-0 w-full h-full" />
      {/* dimmed regions outside the loop window */}
      <div className="absolute top-0 bottom-0 left-0 bg-black/55" style={{ width: `${s}%` }} />
      <div className="absolute top-0 bottom-0 right-0 bg-black/55" style={{ width: `${100 - e}%` }} />
      <div className="absolute top-0 bottom-0 w-[3px] cursor-ew-resize" style={{ left: `${s}%`, background: a }} onPointerDown={onDown('start')} />
      <div className="absolute top-0 bottom-0 w-[3px] cursor-ew-resize -ml-[3px]" style={{ left: `${e}%`, background: a }} onPointerDown={onDown('end')} />
    </div>
  );
}

// ── Looper ──
function LooperBody({ p, a, update, handle }) {
  const [status, setStatus] = useState('idle');
  useEffect(() => { if (handle) handle.onState = (s) => setStatus(s); return () => { if (handle) handle.onState = null; }; }, [handle]);

  const recording = status === 'recording';
  const hasLoop = status === 'ready' || status === 'playing';

  return (
    <div className="space-y-2.5">
      <div className="ui-value text-[9px]" style={{ color: a }}>
        {status === 'idle' ? 'Route a source into ▸ in' : status}
      </div>
      {hasLoop && <WaveformEditor p={p} a={a} update={update} handle={handle} />}
      <div className="flex gap-1.5">
        <button onClick={(e) => { e.stopPropagation(); recording ? handle.stopRecord() : handle.record(); }}
          className={`ui-value flex-1 py-1.5 rounded-lg text-[9px] transition-all ${recording ? '' : 'ctl'}`}
          style={recording ? { background: '#b3261e28', border: '0.5px solid #b3261e', color: '#e08b83' } : { color: '#ffffff' }}>
          {recording ? '● stop rec' : '● record'}
        </button>
        <button onClick={(e) => { e.stopPropagation(); status === 'playing' ? handle.stopLoop() : handle.trigger(); }}
          disabled={!hasLoop}
          className={`ui-value flex-1 py-1.5 rounded-lg text-[9px] transition-all disabled:opacity-30 ${status === 'playing' ? '' : 'ctl ctl-acc'}`}
          style={status === 'playing' ? { background: `${a}33`, border: `0.5px solid ${a}`, color: a } : { '--acc': a, color: '#ffffff' }}>
          {status === 'playing' ? '■ stop' : '▶ loop'}
        </button>
      </div>
      <Row>
        <button onClick={(e) => { e.stopPropagation(); update('reverse', !p.reverse); }}
          className={`ui-value px-2 py-1 rounded-lg text-[9px] transition-all ${p.reverse ? '' : 'ctl ctl-acc'}`}
          style={p.reverse ? { background: `${a}22`, border: `0.5px solid ${a}`, color: a } : { '--acc': a, color: '#ffffff' }}>
          ↺ reverse
        </button>
        <Knob value={p.level} min={0} max={1} onChange={(v) => update('level', v)} label="lvl" accent={a} format={fPct} />
      </Row>
      <div className="ui-label text-[8px] leading-relaxed">Chain effects after the ▸ out to process the loop.</div>
    </div>
  );
}
