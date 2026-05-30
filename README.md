# Polychromia

**Drone & Ambient Music Studio** — a browser-based music creation environment for layering synthesised voices, sampling live global radio streams, and shaping sound with colour.

## Features

- **8 Synth Voices** — each mapped to a shape
  - ○ **Sine** — pure drone, foundational
  - △ **Triangle** — warm, soft overtones
  - □ **Sawtooth** — rich harmonic pad
  - ◇ **Square** — hollow, clarinet-like
  - ⬡ **FM** — metallic, bell-like textures
  - ⬠ **AM** — trembling, organic
  - ★ **Granular** — multi-oscillator texture clouds
  - ◉ **Pad** — lush stacked sine layers

- **Key + Chord System** — 12 root notes × 17 chord types (drones, power, maj/min, 7ths, 9ths, quartal, mystical)

- **Per-Voice Effects Chain** — Reverb, Delay, Chorus, Filter, Saturation, Phaser, Tremolo

- **Colour → Sound** — colour wheel maps to audio parameters
  - Hue → filter warmth (warm/cool)
  - Saturation → chorus & modulation depth
  - Lightness → volume

- **Global Radio Streams** — browse & layer live stations via [Radio Browser](https://www.radio-browser.info/)

- **Layer Everything** — voices, radio streams, all mixed together with individual volume/pan

- **Record & Export** — capture the full mix and export as WAV

- **Waveform Visualiser** — real-time audio display

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Build & Deploy

```bash
npm run build
```

Output goes to `dist/`. Deploy to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages).

## Tech Stack

- **[React](https://react.dev/)** + **[Vite](https://vite.dev/)**
- **[Tone.js](https://tonejs.github.io/)** — Web Audio synthesis engine
- **[Tailwind CSS v4](https://tailwindcss.com/)**
- **[Radio Browser API](https://api.radio-browser.info/)** — open radio station directory
- **Web Audio API** — recording & analysis
- Fonts: [Cal Sans](https://github.com/calcom/font), [Inter](https://fonts.google.com/specimen/Inter)

## Notes on Radio Streams

Radio streams are subject to CORS policies — not all stations will play directly in the browser. The Vite dev server proxies the Radio Browser API. In production, the API is accessed directly (it supports CORS). Individual stream URLs may still be blocked by CORS; this is a browser security limitation that cannot be worked around client-side without a proxy server.
