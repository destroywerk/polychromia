// Color → Audio parameter mapping

export function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s, l };
}

export function colorToAudioParams(hex) {
  const { h, s, l } = hexToHsl(hex);

  // Warmth: reds/oranges/yellows (0-60°, 300-360°) are warm
  const warmth = h < 60 ? 1 - h / 60
    : h < 180 ? 0
    : h < 240 ? (h - 180) / 60 * 0.3
    : h < 300 ? 0.3
    : (h - 300) / 60 * 0.7 + 0.3;

  // Filter cutoff: warm = lower (darker, murkier), cool = higher
  const filterFreq = 200 + (1 - warmth) * 8000;

  // Reverb depth from saturation + warmth
  const reverbWet = 0.1 + s * 0.5 + warmth * 0.2;

  // Volume from lightness
  const volume = 0.1 + l * 0.8;

  // Pitch drift from hue (subtle)
  const detune = (h / 360 - 0.5) * 20;

  // Distortion warmth: very warm colors add subtle harmonic saturation
  const saturation = warmth > 0.7 ? (warmth - 0.7) * 0.3 : 0;

  // Chorus from saturation (rich, colorful = chorus)
  const chorus = s * 0.6;

  return { h, s, l, warmth, filterFreq, reverbWet, volume, detune, saturation, chorus };
}

export function getColorLabel(hex) {
  const { h, s, l } = hexToHsl(hex);

  if (s < 0.1) return l < 0.3 ? 'Shadow' : l > 0.7 ? 'Pale' : 'Neutral';

  if (h < 30 || h > 330) return 'Warm Red';
  if (h < 60) return 'Amber';
  if (h < 90) return 'Gold';
  if (h < 150) return 'Sage';
  if (h < 200) return 'Aqua';
  if (h < 260) return 'Lavender';
  if (h < 300) return 'Violet';
  return 'Rose';
}

export const PRESET_COLORS = [
  { hex: '#d4796a', label: 'Terracotta' },
  { hex: '#d4aa7d', label: 'Amber' },
  { hex: '#c8d48a', label: 'Citron' },
  { hex: '#b8d4c8', label: 'Sage' },
  { hex: '#8ab8d4', label: 'Sky' },
  { hex: '#9a8ad4', label: 'Lavender' },
  { hex: '#d48ac4', label: 'Rose' },
  { hex: '#d4d4d4', label: 'Silver' },
  { hex: '#6a6a7a', label: 'Slate' },
  { hex: '#ffffff', label: 'White' },
];
