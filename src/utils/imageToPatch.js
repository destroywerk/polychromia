// imageToPatch.js
// ─────────────────────────────────────────────────────────────────────────────
// Photo → Patch. Interprets an uploaded image's colours and shapes as a set of
// oscillator "voices" (widgets) for the modular canvas. The output is an array
// of voice descriptors whose keys match the `oscillator` node defaults in
// engine/nodeDefs.js: { wave, root, octave, chord, level, pan, attack, release,
// detune }. App wires each descriptor into graph.addNode('oscillator', x, y) +
// graph.updateParam(...).
//
// The whole pipeline is deterministic (no randomness) so the same image always
// yields the same drone.
//
// MAPPING SUMMARY (colour + shape → sound):
//   • Hue        → root note (0–360° spread across the 12 chromatic NOTES) and
//                  "warmth". Warm hues (reds/oranges/yellows) push voices lower
//                  & darker (lower octave, slower attack); cool hues
//                  (greens/blues) push them brighter (higher octave).
//   • Lightness  → level (brighter = louder) plus an upward octave bias.
//   • Saturation → detune amount and overall richness; also feeds the shared
//                  chord quality (muted image → mellow chords, vivid → bright).
//   • Horizontal centroid of a colour → pan (left colours pan left, etc.).
//   • Edge / texture energy (Sobel luminance gradient sampled over the pixels
//                  belonging to that colour) → waveform:
//                     smooth     → 'sine'
//                     soft       → 'triangle'
//                     textured   → 'sawtooth'
//                     jagged     → 'fm' (saturated) / 'am' (granular-like)
//                     hard-edged / high-contrast → 'square'
//   • Coverage (fraction of image a colour occupies) → louder + longer/slower
//                  envelopes for dominant colours (more drone-like).
// ─────────────────────────────────────────────────────────────────────────────

import { NOTES, getChordNotes } from '../engine/theory';

// Wave options supported by makeOscSynth in nodeDefs.js.
const WAVES = ['sine', 'triangle', 'sawtooth', 'square', 'fm', 'am'];
const DIVISIONS = ['16n', '8n', '4n', '2n', '1n'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Load a File (or pass-through an HTMLImageElement) into an HTMLImageElement.
export function loadImage(source) {
  if (source instanceof HTMLImageElement) return Promise.resolve(source);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    if (source instanceof Blob) img.src = URL.createObjectURL(source);
    else if (typeof source === 'string') img.src = source;
    else reject(new Error('Unsupported image source'));
  });
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      default: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return { h, s, l };
}

// Draw the image small, returning { px, w, h } where px is Uint8ClampedArray RGBA.
function samplePixels(img, targetW = 64) {
  const ratio = img.naturalHeight && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
  const w = clamp(targetW, 8, 64);
  const h = clamp(Math.round(w * ratio), 8, 64);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return { px: ctx.getImageData(0, 0, w, h).data, w, h };
}

// Per-pixel Sobel luminance gradient magnitude, normalised 0..1.
function edgeMap(px, w, h) {
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    lum[i] = (0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2]) / 255;
  }
  const edge = new Float32Array(w * h);
  let max = 1e-6;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const a = lum[(y - 1) * w + (x - 1)], b = lum[(y - 1) * w + x], c = lum[(y - 1) * w + (x + 1)];
      const d = lum[y * w + (x - 1)], f = lum[y * w + (x + 1)];
      const g = lum[(y + 1) * w + (x - 1)], hh = lum[(y + 1) * w + x], ii = lum[(y + 1) * w + (x + 1)];
      const gx = (c + 2 * f + ii) - (a + 2 * d + g);
      const gy = (g + 2 * hh + ii) - (a + 2 * b + c);
      const mag = Math.sqrt(gx * gx + gy * gy);
      edge[y * w + x] = mag;
      if (mag > max) max = mag;
    }
  }
  for (let i = 0; i < edge.length; i++) edge[i] /= max;
  return edge;
}

// Map a normalised edge energy + saturation to a waveform. Biased toward soft,
// lush timbres (sine/triangle) — only busy, high-contrast regions reach for
// brighter saws or a soft AM "granular" shimmer. No square/FM (too harsh for
// ambient).
function waveForEdge(edge, saturation) {
  if (edge < 0.18) return 'sine';
  if (edge < 0.42) return 'triangle';
  if (edge < 0.70) return 'sawtooth';
  return saturation > 0.5 ? 'am' : 'triangle';
}

// Derive a shared chord quality from overall saturation (musical cohesion):
// all drone-friendly extended voicings so the result stays lush.
function chordForMood(avgSat) {
  if (avgSat < 0.22) return 'add9';
  if (avgSat < 0.45) return 'm11';
  if (avgSat < 0.65) return 'maj7';
  return 'sus2';
}

// Fallback rotation through the FULL generator family, used only to guarantee
// variety if a photo's regions would otherwise all collapse to one type.
const TYPE_ROTATION = ['drift', 'grain', 'oscillator', 'noteCycler', 'synthSeq', 'arp', 'noise'];

// Pick a generator type from a region's texture + colour character. The wider
// pool means different images reach for different voices:
//   • hazy / desaturated         → Noise Bed
//   • very textured + vivid       → Synth Sequencer / Grain Cloud
//   • textured                    → Arpeggiator (bright) / Sequencer (dark)
//   • very smooth / low edge       → Drift Pad (light) / Oscillator (dark)
//   • vivid, saturated colour      → Oscillator (defined tonal voice)
function pickType({ s, l, edge }, i) {
  if (s < 0.14) return 'noise';
  if (edge > 0.55) return s > 0.45 ? 'synthSeq' : 'grain';
  if (edge > 0.36) return l > 0.5 ? 'arp' : 'noteCycler';
  if (edge < 0.16) return l > 0.55 ? 'drift' : 'oscillator';
  if (s > 0.6) return 'oscillator';
  return i % 2 === 0 ? 'drift' : 'grain';
}

// Pick a synthSeq preset voice from a region's character.
function pickPreset(f) {
  if (f.edge > 0.5) return 'pluck';
  if (f.l > 0.6) return 'bell';
  if (f.l < 0.35) return 'bass';
  if (f.s > 0.5) return 'keys';
  return 'pad';
}

// In-key note list for sequence-type generators.
function genNotes(root, octave, chord, n) {
  const cn = getChordNotes(root, octave, chord);
  return Array.from({ length: n }, (_, i) => cn[i % cn.length]);
}

// Build a { type, params } descriptor containing ONLY the keys valid for `type`
// (matching each source's defaults in nodeDefs.js), tailored from the region's
// colour/shape features. Long, lush envelopes are kept wherever supported.
function buildDescriptor(type, f, sharedChord) {
  const { hue, s, l, coverage, edge, warm, centroidX } = f;
  const root = NOTES[Math.round((hue / 360) * 12) % 12];
  const baseOct = clamp(Math.round(3 - warm * 2 + (l - 0.5) * 1.4), 1, 4);
  const level = clamp(0.2 + l * 0.3 + coverage * 0.2, 0.16, 0.55);
  const pan = clamp(centroidX * 2 - 1, -1, 1);
  const attack = clamp(2 + warm * 3 + coverage * 3, 1.5, 8);
  const release = clamp(4 + coverage * 6 + warm * 3, 3, 14);
  const division = DIVISIONS[clamp(Math.round((1 - edge) * (DIVISIONS.length - 1)), 0, DIVISIONS.length - 1)];

  switch (type) {
    case 'drift':
      return { type, params: {
        root, octave: clamp(baseOct - 1, 1, 3), chord: sharedChord,
        spread: clamp(0.3 + s * 0.6, 0.2, 0.95),
        motion: clamp(0.05 + edge * 0.5, 0.03, 0.6),
        level, pan,
        attack: clamp(attack + 1, 2, 9), release: clamp(release + 2, 4, 16),
      } };
    case 'grain':
      return { type, params: {
        root, octave: clamp(baseOct, 2, 4), chord: sharedChord,
        density: clamp(Math.round(3 + edge * 5), 2, 8),
        drift: Math.round(clamp(6 + edge * 30 + s * 10, 4, 45)),
        shimmer: clamp(0.2 + edge * 0.6, 0.1, 0.9),
        level, pan, attack, release,
      } };
    case 'noise': {
      const color = warm > 0.62 ? 'brown' : (warm < 0.38 ? 'white' : 'pink');
      return { type, params: {
        color,
        cutoff: Math.round(clamp(200 + l * 3200 + (1 - warm) * 1400, 200, 6000)),
        q: clamp(0.6 + s * 3, 0.4, 5),
        motion: clamp(0.03 + edge * 0.5, 0.02, 0.6),
        level: clamp(level * 0.9, 0.14, 0.5), pan,
        attack: clamp(attack + 1, 2, 9), release: clamp(release + 1, 3, 14),
      } };
    }
    case 'noteCycler':
      return { type, params: {
        notes: genNotes(root, clamp(baseOct, 2, 4), sharedChord, clamp(3 + Math.round(edge * 3), 3, 6)),
        division, mode: edge > 0.45 ? 'random' : 'up',
        wave: waveForEdge(edge, s), gate: clamp(0.6 + (1 - edge) * 0.35, 0.5, 0.95),
        level, pan,
      } };
    case 'synthSeq':
      return { type, params: {
        notes: genNotes(root, clamp(baseOct, 2, 4), sharedChord, clamp(3 + Math.round(edge * 3), 3, 6)),
        division, mode: edge > 0.5 ? 'random' : 'up', preset: pickPreset(f),
        gate: clamp(0.5 + (1 - edge) * 0.4, 0.4, 0.9), level, pan,
      } };
    case 'arp':
      return { type, params: {
        root, octave: clamp(baseOct, 2, 4), chord: sharedChord,
        pattern: edge > 0.5 ? 'updown' : 'up', rate: division,
        octaves: clamp(1 + Math.round(coverage * 3), 1, 3),
        wave: waveForEdge(edge, s), gate: clamp(0.4 + (1 - edge) * 0.4, 0.35, 0.85),
        level, pan,
      } };
    case 'oscillator':
    default:
      return { type: 'oscillator', params: {
        wave: waveForEdge(edge, s), root, octave: baseOct,
        chord: sharedChord, level, pan, attack, release,
        detune: Math.round((s * 2 - 1) * 18),
      } };
  }
}

// Choose a 2–4 effect chain from the image's overall character. The last effect
// is always a reverb (so the chain terminates into one ambient wash → master).
// Different brightness / texture / saturation profiles yield different chains.
function pickEffects({ avgSat, avgEdge, avgLight, warmAvg }) {
  const fx = [];
  // Tone shaping from warmth / brightness.
  if (warmAvg > 0.55) {
    fx.push({ type: 'filter', params: { type: 'lowpass', cutoff: Math.round(clamp(1200 + avgLight * 5000, 600, 8000)), resonance: clamp(0.5 + avgSat * 3, 0.3, 6) } });
  } else if (avgLight > 0.6) {
    fx.push({ type: 'eq', params: { low: -2, mid: 1, high: Math.round(clamp(avgLight * 6, 0, 6)) } });
  }
  // Texture → glitch / grit / echo.
  if (avgEdge > 0.45) {
    fx.push(avgSat > 0.5
      ? { type: 'stutter', params: { rate: '8n', depth: clamp(0.4 + avgEdge * 0.5, 0.3, 0.95), mix: clamp(0.3 + avgEdge * 0.4, 0.2, 0.7) } }
      : { type: 'pixelate', params: { bits: Math.round(clamp(8 - avgEdge * 5, 2, 8)), rate: Math.round(clamp(8000 - avgEdge * 6000, 1200, 8000)), mix: clamp(0.3 + avgEdge * 0.3, 0.2, 0.6) } });
  } else if (avgEdge > 0.28) {
    fx.push({ type: 'delay', params: { time: '4n', feedback: clamp(0.2 + avgEdge * 0.5, 0.2, 0.7), wet: clamp(0.2 + avgEdge * 0.3, 0.2, 0.5) } });
  }
  // Darkness / haze → smear / spectral freeze.
  if (avgLight < 0.4) {
    fx.push(avgSat < 0.4
      ? { type: 'freeze', params: { hold: clamp(0.85 + avgLight * 0.1, 0.8, 0.97), tone: Math.round(clamp(1500 + avgLight * 3000, 800, 5000)), mix: 0.5 } }
      : { type: 'timestretch', params: { pitch: 0, window: clamp(0.1 + avgLight * 0.2, 0.05, 0.4), feedback: clamp(0.3 + avgSat * 0.4, 0.2, 0.7), mix: 0.5 } });
  }
  // Saturation → harmonic thickening or pitch warp.
  if (avgSat > 0.55) {
    fx.push({ type: 'harmonizer', params: { voices: avgSat > 0.7 ? 3 : 2, interval: warmAvg > 0.5 ? 7 : 5, detune: Math.round(clamp(avgSat * 12, 4, 16)), mix: clamp(0.3 + avgSat * 0.3, 0.3, 0.6) } });
  } else if (avgSat > 0.35 && fx.length < 2) {
    fx.push({ type: 'warp', params: { pitch: 0, depth: clamp(0.2 + avgSat * 0.4, 0.2, 0.6), mix: clamp(0.3 + avgSat * 0.3, 0.2, 0.6) } });
  }
  // Always glue with a reverb (kept last → routes into master).
  const reverb = { type: 'reverb', params: { decay: clamp(4 + (1 - avgEdge) * 6 + avgLight * 3, 4, 13), wet: clamp(0.35 + (1 - avgEdge) * 0.25, 0.3, 0.65) } };
  if (fx.length > 3) fx.length = 3;   // cap chain to 4 incl. reverb
  fx.push(reverb);
  return fx;
}

const mean = (arr, key) => (arr.length ? arr.reduce((s, f) => s + f[key], 0) / arr.length : 0);

/**
 * Analyse an image and return `{ voices, effects }`.
 *   voices  : Array<{ type, params }> — full generator palette (drift/grain/
 *             oscillator/noise/noteCycler/synthSeq/arp).
 *   effects : Array<{ type, params }> — a 2–4 node effect chain (ending in
 *             reverb) drawn from the full effect palette by image character.
 * @param {File|Blob|HTMLImageElement|string} source
 * @param {{ maxVoices?: number }} [opts]
 * @returns {Promise<{ voices: Array<object>, effects: Array<object> }>}
 */
export async function imageToPatch(source, opts = {}) {
  const maxVoices = clamp(opts.maxVoices ?? 5, 3, 6);
  const img = await loadImage(source);
  const { px, w, h } = samplePixels(img, 64);
  const edge = edgeMap(px, w, h);

  // ── Colour quantization: bucket by 3 bits per channel (512 buckets max) and
  //    accumulate colour sums, coverage, horizontal centroid and edge energy.
  const buckets = new Map();
  let satSum = 0;
  let pxCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const r = px[o], g = px[o + 1], b = px[o + 2], alpha = px[o + 3];
      if (alpha < 8) continue; // skip transparent pixels
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
      let bk = buckets.get(key);
      if (!bk) { bk = { r: 0, g: 0, b: 0, n: 0, xs: 0, edge: 0 }; buckets.set(key, bk); }
      bk.r += r; bk.g += g; bk.b += b; bk.n++; bk.xs += x; bk.edge += edge[i];
      const { s } = rgbToHsl(r, g, b);
      satSum += s;
      pxCount++;
    }
  }
  if (!pxCount) return { voices: [], effects: [] };
  const avgSat = satSum / pxCount;
  const sharedChord = chordForMood(avgSat);

  // Sort buckets by coverage, then keep the dominant few (>= ~3% coverage).
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  const dominant = sorted.filter((bk) => bk.n / pxCount >= 0.03).slice(0, maxVoices);
  const chosen = dominant.length >= 3 ? dominant : sorted.slice(0, Math.min(maxVoices, sorted.length));

  // ── Per-region feature extraction (deterministic) ──
  const feats = chosen.map((bk) => {
    const r = bk.r / bk.n, g = bk.g / bk.n, b = bk.b / bk.n;
    const { h: hue, s, l } = rgbToHsl(r, g, b);
    return {
      hue, s, l,
      coverage: bk.n / pxCount,          // 0..1
      edge: bk.edge / bk.n,              // 0..1 avg edge energy over the bucket
      centroidX: bk.xs / bk.n / w,       // 0..1 left→right
      warm: (Math.cos((hue * Math.PI) / 180) + 1) / 2,  // 1 warm (red) … 0 cool (cyan)
    };
  });

  // Choose a generator type per region from its texture/colour character.
  let types = feats.map((f, i) => pickType(f, i));
  // Guarantee variety: if the photo collapses to < 2 distinct types, rotate
  // through the full generator family by index (still deterministic).
  if (new Set(types).size < 2 && types.length >= 3) {
    types = types.map((_, i) => TYPE_ROTATION[i % TYPE_ROTATION.length]);
  }

  const voices = feats.map((f, i) => buildDescriptor(types[i], f, sharedChord));

  // Order low→high (octave for tonal types; others → treat as mid) so the
  // spawn cascade reads bass→treble.
  voices.sort((a, b) => (a.params.octave ?? 3) - (b.params.octave ?? 3));

  // Widen the stereo field across the voice set for an enveloping wash.
  const n = voices.length;
  voices.forEach((v, i) => {
    const spread = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
    v.params.pan = clamp((v.params.pan ?? 0) * 0.4 + spread * 0.6, -1, 1);
  });

  // Pick an effect chain from the overall image character.
  const effects = pickEffects({
    avgSat,
    avgEdge: mean(feats, 'edge'),
    avgLight: mean(feats, 'l'),
    warmAvg: mean(feats, 'warm'),
  });

  return { voices, effects };
}
