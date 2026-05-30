import { useState, useCallback, useRef } from 'react';
import { audioEngine, getChordFrequencies, VOICE_TYPES } from '../engine/audioEngine';

let voiceCounter = 0;
let samplerCounter = 0;

export function useAudioEngine() {
  const [initialized, setInitialized] = useState(false);
  const [voices, setVoices] = useState([]);
  const [radioSamplers, setRadioSamplers] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [masterVolume, setMasterVolumeState] = useState(0.85);

  const init = useCallback(async () => {
    await audioEngine.init();
    setInitialized(true);
  }, []);

  // ── Voices ──────────────────────────────────────────────────────────────────

  const addVoice = useCallback((voiceType, params = {}) => {
    const id = `voice-${++voiceCounter}`;
    const voiceDef = VOICE_TYPES[voiceType];
    const voice = audioEngine.createVoice(id, voiceType, params);
    if (!voice) return;

    const voiceState = {
      id,
      type: voiceType,
      label: voiceDef.label,
      shape: voiceDef.shape,
      color: voiceDef.color,
      active: false,
      volume: params.volume ?? 0.7,
      pan: params.pan ?? 0,
      attack: params.attack ?? 2,
      release: params.release ?? 4,
      effects: params.effects ?? {},
      colorHex: null,
    };

    setVoices(prev => [...prev, voiceState]);
    return id;
  }, []);

  const removeVoice = useCallback((id) => {
    audioEngine.removeVoice(id);
    setVoices(prev => prev.filter(v => v.id !== id));
  }, []);

  const toggleVoice = useCallback((id, rootNote, octave, chordType) => {
    const voice = voices.find(v => v.id === id);
    if (!voice) return;

    if (voice.active) {
      audioEngine.stopVoice(id);
      setVoices(prev => prev.map(v => v.id === id ? { ...v, active: false } : v));
    } else {
      const notes = getChordFrequencies(rootNote, octave, chordType);
      audioEngine.playVoice(id, notes);
      setVoices(prev => prev.map(v => v.id === id ? { ...v, active: true, notes } : v));
    }
  }, [voices]);

  const updateVoiceParam = useCallback((id, key, value) => {
    setVoices(prev => prev.map(v => v.id === id ? { ...v, [key]: value } : v));

    if (key === 'volume') audioEngine.updateVoiceVolume(id, value);
    else if (key === 'pan') audioEngine.updateVoicePan(id, value);
    else if (key.startsWith('effects.')) {
      const effectKey = key.replace('effects.', '');
      audioEngine.updateVoiceEffect(id, effectKey, value);
    }
  }, []);

  const updateVoiceEffects = useCallback((id, effectKey, value) => {
    setVoices(prev => prev.map(v =>
      v.id === id ? { ...v, effects: { ...v.effects, [effectKey]: value } } : v
    ));
    audioEngine.updateVoiceEffect(id, effectKey, value);
  }, []);

  const applyColorToVoice = useCallback((id, hsl, hex) => {
    audioEngine.applyColorToVoice(id, hsl);
    setVoices(prev => prev.map(v => v.id === id ? { ...v, colorHex: hex } : v));
  }, []);

  const refreshVoiceNotes = useCallback((id, rootNote, octave, chordType) => {
    const voice = voices.find(v => v.id === id);
    if (!voice || !voice.active) return;
    const notes = getChordFrequencies(rootNote, octave, chordType);
    audioEngine.stopVoice(id, true);
    setTimeout(() => audioEngine.playVoice(id, notes), 100);
    setVoices(prev => prev.map(v => v.id === id ? { ...v, notes } : v));
  }, [voices]);

  // ── Radio Samplers ──────────────────────────────────────────────────────────

  const addRadioSampler = useCallback((station) => {
    const id = `radio-${++samplerCounter}`;
    audioEngine.addRadioSampler(id, station.url_resolved || station.url, 10);
    const samplerState = {
      id,
      station,
      volume: 0.6,
      playing: false,
      snippetDuration: 10,
    };
    setRadioSamplers(prev => [...prev, samplerState]);
    return id;
  }, []);

  const toggleRadioSampler = useCallback(async (id) => {
    const sampler = radioSamplers.find(s => s.id === id);
    if (!sampler) return;

    if (sampler.playing) {
      audioEngine.stopRadioSampler(id);
      setRadioSamplers(prev => prev.map(s => s.id === id ? { ...s, playing: false } : s));
    } else {
      await audioEngine.playRadioSampler(id);
      setRadioSamplers(prev => prev.map(s => s.id === id ? { ...s, playing: true } : s));
    }
  }, [radioSamplers]);

  const updateSamplerVolume = useCallback((id, volume) => {
    audioEngine.setRadioSamplerVolume(id, volume);
    setRadioSamplers(prev => prev.map(s => s.id === id ? { ...s, volume } : s));
  }, []);

  const removeRadioSampler = useCallback((id) => {
    audioEngine.removeRadioSampler(id);
    setRadioSamplers(prev => prev.filter(s => s.id !== id));
  }, []);

  // ── Master & Recording ──────────────────────────────────────────────────────

  const setMasterVolume = useCallback((vol) => {
    audioEngine.setMasterVolume(vol);
    setMasterVolumeState(vol);
  }, []);

  const startRecording = useCallback(async () => {
    await audioEngine.startRecording();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(async (format = 'wav') => {
    const blob = await audioEngine.stopRecording(format);
    setIsRecording(false);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polychromia-${Date.now()}.${format === 'mp3' ? 'webm' : 'wav'}`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    initialized, init,
    voices, addVoice, removeVoice, toggleVoice,
    updateVoiceParam, updateVoiceEffects, applyColorToVoice, refreshVoiceNotes,
    radioSamplers, addRadioSampler, toggleRadioSampler, updateSamplerVolume, removeRadioSampler,
    masterVolume, setMasterVolume,
    isRecording, startRecording, stopRecording,
  };
}
