import * as Tone from 'tone';

// ─── Constants ────────────────────────────────────────────────────────────────

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const CHORD_TYPES = {
  'Drone (Root)':  [0],
  'Power':         [0, 7],
  'Major':         [0, 4, 7],
  'Minor':         [0, 3, 7],
  'Major 7':       [0, 4, 7, 11],
  'Minor 7':       [0, 3, 7, 10],
  'Dominant 7':    [0, 4, 7, 10],
  'Suspended 2':   [0, 2, 7],
  'Suspended 4':   [0, 5, 7],
  'Add 9':         [0, 4, 7, 14],
  'Major 9':       [0, 4, 7, 11, 14],
  'Minor 9':       [0, 3, 7, 10, 14],
  'Diminished':    [0, 3, 6],
  'Augmented':     [0, 4, 8],
  'Cluster':       [0, 1, 2, 3],
  'Quartal':       [0, 5, 10, 15],
  'Mystical':      [0, 6, 10, 16, 21],
};

export const VOICE_TYPES = {
  sine:     { label: 'Sine',     shape: 'circle',   color: '#b8d4c8', synth: 'Synth',     oscType: 'sine' },
  triangle: { label: 'Triangle', shape: 'triangle', color: '#d4c4b8', synth: 'Synth',     oscType: 'triangle' },
  saw:      { label: 'Sawtooth', shape: 'square',   color: '#c4b8d4', synth: 'PolySynth', oscType: 'sawtooth' },
  square:   { label: 'Square',   shape: 'diamond',  color: '#b8c8d4', synth: 'Synth',     oscType: 'square' },
  fm:       { label: 'FM',       shape: 'hexagon',  color: '#d4b8c4', synth: 'FMSynth',   oscType: null },
  am:       { label: 'AM',       shape: 'pentagon', color: '#d4cbb8', synth: 'AMSynth',   oscType: null },
  granular: { label: 'Granular', shape: 'star',     color: '#c8d4b8', synth: 'Granular',  oscType: null },
  pad:      { label: 'Pad',      shape: 'blob',     color: '#d4b8d4', synth: 'PolySynth', oscType: 'sine4' },
};

// ─── Chord helpers ────────────────────────────────────────────────────────────

export function getChordFrequencies(rootNote, octave, chordType) {
  const intervals = CHORD_TYPES[chordType] || [0];
  const rootIdx = NOTES.indexOf(rootNote);
  return intervals.map(interval => {
    const noteIdx = (rootIdx + interval) % 12;
    const octaveOffset = Math.floor((rootIdx + interval) / 12);
    return `${NOTES[noteIdx]}${octave + octaveOffset}`;
  });
}

// ─── Granular Synth (LFO-modulated noise + oscillator clusters) ───────────────

class GranularVoice {
  constructor(params = {}) {
    this.output = new Tone.Gain(1);
    this.nodes = [];
    this._buildGrain(params);
  }

  _buildGrain(params) {
    // Multi-oscillator cluster with random detuning = granular texture
    const count = 6;
    for (let i = 0; i < count; i++) {
      const osc = new Tone.Oscillator({
        type: 'sine',
        frequency: 220,
        volume: -18 - Math.random() * 6,
      });
      const detuneLfo = new Tone.LFO({
        frequency: 0.05 + Math.random() * 0.3,
        min: -30,
        max: 30,
        type: 'random',
      });
      const ampLfo = new Tone.LFO({
        frequency: 0.8 + Math.random() * 4,
        min: 0,
        max: 1,
        type: 'sine',
      });
      const ampGain = new Tone.Gain(0);
      ampLfo.connect(ampGain.gain);
      detuneLfo.connect(osc.detune);
      osc.connect(ampGain);
      ampGain.connect(this.output);
      this.nodes.push({ osc, detuneLfo, ampLfo, ampGain });
    }

    // Add a noise shimmer
    const noise = new Tone.Noise({ type: 'pink', volume: -30 });
    const noiseFilter = new Tone.Filter({ frequency: 1200, type: 'bandpass', Q: 4 });
    const noiseLfo = new Tone.LFO({ frequency: 0.2, min: 600, max: 2400 });
    noiseLfo.connect(noiseFilter.frequency);
    noise.connect(noiseFilter);
    noiseFilter.connect(this.output);
    this.nodes.push({ noise, noiseFilter, noiseLfo });
  }

  setFrequency(noteOrFreq) {
    const freq = typeof noteOrFreq === 'string' ? Tone.Frequency(noteOrFreq).toFrequency() : noteOrFreq;
    this.nodes.forEach(({ osc }, i) => {
      if (osc) {
        const spread = (i - 3) * 0.7;
        osc.frequency.rampTo(freq * (1 + spread * 0.005), 1);
      }
    });
  }

  start() {
    this.nodes.forEach(({ osc, detuneLfo, ampLfo, noiseLfo, noise }) => {
      try { osc?.start(); } catch (e) {}
      try { detuneLfo?.start(); } catch (e) {}
      try { ampLfo?.start(); } catch (e) {}
      try { noiseLfo?.start(); } catch (e) {}
      try { noise?.start(); } catch (e) {}
    });
  }

  stop() {
    this.nodes.forEach(({ osc, detuneLfo, ampLfo, noiseLfo, noise }) => {
      try { osc?.stop(); } catch (e) {}
      try { detuneLfo?.stop(); } catch (e) {}
      try { ampLfo?.stop(); } catch (e) {}
      try { noiseLfo?.stop(); } catch (e) {}
      try { noise?.stop(); } catch (e) {}
    });
  }

  dispose() {
    this.stop();
    this.nodes.forEach(node => {
      Object.values(node).forEach(n => { try { n?.dispose(); } catch (e) {} });
    });
    this.output.dispose();
  }

  connect(dest) {
    this.output.connect(dest);
    return this;
  }

  disconnect() {
    this.output.disconnect();
  }
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

class AudioEngine {
  constructor() {
    this.voices = new Map();
    this.radioSamplers = new Map();
    this.masterLimiter = null;
    this.masterGain = null;
    this.recorder = null;
    this.isRecording = false;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    await Tone.start();

    this.masterGain = new Tone.Gain(0.85).toDestination();
    this.masterLimiter = new Tone.Limiter(-3).connect(this.masterGain);
    this.recorder = new Tone.Recorder();
    this.masterGain.connect(this.recorder);

    this.initialized = true;
  }

  // ── Voice Management ────────────────────────────────────────────────────────

  createVoice(id, voiceType, params = {}) {
    const voiceDef = VOICE_TYPES[voiceType];
    if (!voiceDef) return null;

    const effects = this._buildEffectsChain(params.effects || {});
    const synth = this._buildSynth(voiceType, params);

    const gain = new Tone.Gain(params.volume ?? 0.7);
    const panner = new Tone.Panner(params.pan ?? 0);

    const connectTarget = effects.length > 0 ? effects[0] : panner;
    if (synth instanceof GranularVoice) {
      synth.connect(connectTarget);
    } else {
      synth.connect(connectTarget);
    }

    if (effects.length > 0) {
      for (let i = 0; i < effects.length - 1; i++) effects[i].connect(effects[i + 1]);
      effects[effects.length - 1].connect(panner);
    }
    panner.connect(gain);
    gain.connect(this.masterLimiter);

    const voice = {
      id, type: voiceType,
      synth, effects, gain, panner,
      params: { ...params },
      notes: [], active: false,
    };

    this.voices.set(id, voice);
    return voice;
  }

  _buildSynth(voiceType, params) {
    const voiceDef = VOICE_TYPES[voiceType];
    const envelope = {
      attack: params.attack ?? 2,
      decay: 0.1,
      sustain: 1,
      release: params.release ?? 4,
    };

    switch (voiceDef.synth) {
      case 'FMSynth':
        return new Tone.FMSynth({
          modulationIndex: 8,
          envelope,
          modulationEnvelope: { attack: 2, decay: 0.1, sustain: 1, release: 4 },
        });
      case 'AMSynth':
        return new Tone.AMSynth({ envelope });
      case 'Granular':
        return new GranularVoice(params);
      case 'PolySynth':
        return new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: voiceDef.oscType || 'sine4' },
          envelope,
        });
      default:
        return new Tone.Synth({
          oscillator: { type: voiceDef.oscType || 'sine' },
          envelope,
        });
    }
  }

  _buildEffectsChain(ep = {}) {
    const chain = [];
    if (ep.reverb > 0)     chain.push(new Tone.Reverb({ decay: Math.max(0.5, ep.reverb * 15), wet: Math.min(ep.reverb, 0.92) }));
    if (ep.delay > 0)      chain.push(new Tone.FeedbackDelay({ delayTime: '8n', feedback: ep.delay * 0.55, wet: ep.delay * 0.5 }));
    if (ep.chorus > 0)     chain.push(new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: ep.chorus, wet: 0.6 }).start());
    if (ep.filter > 0)     chain.push(new Tone.Filter({ frequency: 200 + ep.filter * 6000, type: ep.filterType || 'lowpass', rolloff: -24 }));
    if (ep.distortion > 0) chain.push(new Tone.Distortion({ distortion: ep.distortion * 0.7, wet: ep.distortion * 0.6 }));
    if (ep.phaser > 0)     chain.push(new Tone.Phaser({ frequency: 0.5, octaves: 3, wet: ep.phaser }));
    if (ep.tremolo > 0)    chain.push(new Tone.Tremolo({ frequency: 2, depth: ep.tremolo, wet: 1 }).start());
    return chain;
  }

  _reconnect(voice) {
    const { synth, effects, panner, gain } = voice;
    try { synth.disconnect(); } catch (e) {}
    effects.forEach(e => { try { e.disconnect(); } catch (err) {} });

    const connectTarget = effects.length > 0 ? effects[0] : panner;
    synth.connect(connectTarget);
    if (effects.length > 0) {
      for (let i = 0; i < effects.length - 1; i++) effects[i].connect(effects[i + 1]);
      effects[effects.length - 1].connect(panner);
    }
    panner.connect(gain);
    gain.connect(this.masterLimiter);
  }

  updateVoiceEffect(id, effectKey, value) {
    const voice = this.voices.get(id);
    if (!voice) return;
    voice.params.effects = { ...voice.params.effects, [effectKey]: value };

    const wasActive = voice.active;
    if (wasActive) this.stopVoice(id);

    voice.effects.forEach(e => { try { e.dispose(); } catch (err) {} });
    voice.effects = this._buildEffectsChain(voice.params.effects);
    this._reconnect(voice);

    if (wasActive && voice.notes.length) {
      setTimeout(() => this.playVoice(id, voice.notes), 150);
      voice.active = true;
    }
  }

  playVoice(id, notes) {
    const voice = this.voices.get(id);
    if (!voice) return;
    voice.notes = notes;
    voice.active = true;

    const synth = voice.synth;

    if (synth instanceof GranularVoice) {
      synth.setFrequency(notes[0] || 'D3');
      synth.start();
      return;
    }

    if (synth instanceof Tone.PolySynth) {
      synth.triggerAttack(notes, Tone.now());
    } else {
      synth.triggerAttack(notes[0] || 'D3', Tone.now());
    }
  }

  stopVoice(id) {
    const voice = this.voices.get(id);
    if (!voice) return;
    voice.active = false;
    const synth = voice.synth;

    if (synth instanceof GranularVoice) {
      synth.stop();
    } else if (synth instanceof Tone.PolySynth) {
      synth.releaseAll();
    } else {
      try { synth.triggerRelease(); } catch (e) {}
    }
  }

  updateVoiceVolume(id, volume) {
    const voice = this.voices.get(id);
    if (voice) voice.gain.gain.rampTo(volume, 0.1);
  }

  updateVoicePan(id, pan) {
    const voice = this.voices.get(id);
    if (voice) voice.panner.pan.rampTo(pan, 0.1);
  }

  removeVoice(id) {
    const voice = this.voices.get(id);
    if (!voice) return;
    this.stopVoice(id);
    setTimeout(() => {
      try { voice.synth.dispose?.() || voice.synth.stop?.(); } catch (e) {}
      voice.effects.forEach(e => { try { e.dispose(); } catch (err) {} });
      try { voice.gain.dispose(); } catch (e) {}
      try { voice.panner.dispose(); } catch (e) {}
    }, 600);
    this.voices.delete(id);
  }

  // ── Color → Audio ────────────────────────────────────────────────────────────

  applyColorToVoice(id, hsl) {
    const voice = this.voices.get(id);
    if (!voice) return;
    const { h, s, l } = hsl;
    const warmth = h < 60 ? 1 - h / 60
      : h < 180 ? 0
      : h < 240 ? (h - 180) / 60 * 0.3
      : h < 300 ? 0.3
      : (h - 300) / 60 * 0.7 + 0.3;

    voice.gain.gain.rampTo(0.1 + l * 0.85, 0.4);

    const filterEff = voice.effects.find(e => e instanceof Tone.Filter);
    if (filterEff) filterEff.frequency.rampTo(200 + (1 - warmth) * 7000, 0.6);

    const chorusEff = voice.effects.find(e => e instanceof Tone.Chorus);
    if (chorusEff) chorusEff.depth = s;
  }

  // ── Radio Samplers ──────────────────────────────────────────────────────────

  addRadioSampler(id, streamUrl) {
    const gain = new Tone.Gain(0.6).connect(this.masterLimiter);
    const reverb = new Tone.Reverb({ decay: 3, wet: 0.25 }).connect(gain);

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = streamUrl;

    let source = null;
    try {
      source = Tone.getContext().rawContext.createMediaElementSource(audio);
      source.connect(reverb.input);
    } catch (e) {
      console.warn('MediaElementSource error:', e);
    }

    const sampler = { id, audio, source, gain, reverb, playing: false };
    this.radioSamplers.set(id, sampler);
    return sampler;
  }

  async playRadioSampler(id) {
    const sampler = this.radioSamplers.get(id);
    if (!sampler) return;
    sampler.playing = true;
    try { await sampler.audio.play(); } catch (e) { console.warn('Stream error:', e); }
  }

  stopRadioSampler(id) {
    const sampler = this.radioSamplers.get(id);
    if (!sampler) return;
    sampler.playing = false;
    sampler.audio.pause();
  }

  setRadioSamplerVolume(id, volume) {
    const sampler = this.radioSamplers.get(id);
    if (sampler) sampler.gain.gain.rampTo(volume, 0.1);
  }

  removeRadioSampler(id) {
    const sampler = this.radioSamplers.get(id);
    if (!sampler) return;
    this.stopRadioSampler(id);
    sampler.audio.src = '';
    try { sampler.gain.dispose(); } catch (e) {}
    try { sampler.reverb.dispose(); } catch (e) {}
    this.radioSamplers.delete(id);
  }

  // ── Master ───────────────────────────────────────────────────────────────────

  setMasterVolume(vol) {
    if (this.masterGain) this.masterGain.gain.rampTo(vol, 0.1);
  }

  // ── Recording ────────────────────────────────────────────────────────────────

  async startRecording() {
    if (!this.initialized || this.isRecording) return;
    this.recorder.start();
    this.isRecording = true;
  }

  async stopRecording() {
    if (!this.isRecording) return null;
    const blob = await this.recorder.stop();
    this.isRecording = false;
    return blob;
  }

  dispose() {
    this.voices.forEach((_, id) => this.removeVoice(id));
    this.radioSamplers.forEach((_, id) => this.removeRadioSampler(id));
    try { this.masterGain?.dispose(); } catch (e) {}
    try { this.masterLimiter?.dispose(); } catch (e) {}
  }
}

export const audioEngine = new AudioEngine();
