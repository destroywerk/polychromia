import React, { useState, useCallback, useEffect } from 'react';
import { useAudioEngine } from './hooks/useAudioEngine';
import { VoiceCard } from './components/VoiceCard';
import { VoicePicker } from './components/VoicePicker';
import { MasterControls } from './components/MasterControls';
import { RadioPanel } from './components/RadioPanel';
import { ColorMapper } from './components/ColorMapper';
import { Visualizer } from './components/Visualizer';
import { AmbientBackground } from './components/AmbientBackground';

const PANELS = ['voices', 'radio', 'colour', 'about'];
const PANEL_LABELS = { voices: 'Voices', radio: 'Streams', colour: 'Colour', about: 'Info' };

function StartOverlay({ onStart }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at center, #111116 0%, #0a0a0b 70%)' }}>

      {/* Ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #b8d4c8 0%, transparent 70%)', filter: 'blur(60px)', animation: 'pulse 6s ease-in-out infinite' }} />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #c4b8d4 0%, transparent 70%)', filter: 'blur(50px)', animation: 'pulse 8s ease-in-out infinite 2s' }} />
        <div className="absolute top-1/2 right-1/3 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #d4b8c4 0%, transparent 70%)', filter: 'blur(40px)', animation: 'pulse 10s ease-in-out infinite 1s' }} />
      </div>

      <div className="relative text-center space-y-8 max-w-lg px-8">
        <div>
          <h1 className="font-cal text-6xl text-white tracking-tight mb-3">Polychromia</h1>
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-8 bg-white/10" />
            <span className="text-[10px] text-white/25 uppercase tracking-[0.3em]">Drone & Ambient Studio</span>
            <div className="h-px w-8 bg-white/10" />
          </div>
        </div>

        <p className="text-white/30 text-sm leading-relaxed" style={{ fontWeight: 200, maxWidth: '340px', margin: '0 auto' }}>
          Layer synthesised voices, sample radio streams from across the world, and let colour guide your sound.
        </p>

        <div className="space-y-3">
          <button
            onClick={onStart}
            className="block w-48 mx-auto py-3 rounded-full text-xs uppercase tracking-[0.2em] transition-all duration-300 hover:opacity-90"
            style={{ background: 'rgba(184,212,200,0.12)', border: '1px solid rgba(184,212,200,0.25)', color: '#b8d4c8' }}
          >
            Begin
          </button>
          <p className="text-white/15 text-[10px] uppercase tracking-widest">
            Audio activates on interaction
          </p>
        </div>

        <div className="flex justify-center gap-8 pt-4">
          {[
            { shape: '○', label: 'Sine' },
            { shape: '★', label: 'Granular' },
            { shape: '□', label: 'Saw' },
            { shape: '⬡', label: 'FM' },
          ].map(({ shape, label }) => (
            <div key={label} className="text-center">
              <div className="text-white/20 text-xl mb-1">{shape}</div>
              <div className="text-white/15 text-[9px] uppercase tracking-widest">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.1); opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const engine = useAudioEngine();
  const [started, setStarted] = useState(false);
  const [activePanel, setActivePanel] = useState('voices');
  const [rootNote, setRootNote] = useState('D');
  const [octave, setOctave] = useState(3);
  const [chordType, setChordType] = useState('Minor 7');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleStart = async () => {
    await engine.init();
    setStarted(true);
  };

  const handleAddVoice = useCallback((type) => {
    engine.addVoice(type, { effects: { reverb: 0.5 } });
    setActivePanel('voices');
  }, [engine]);

  const handleToggleVoice = useCallback((id) => {
    engine.toggleVoice(id, rootNote, octave, chordType);
  }, [engine, rootNote, octave, chordType]);

  const handleRefreshAll = useCallback((note, oct, chord) => {
    engine.voices.forEach(v => {
      if (v.active) engine.refreshVoiceNotes(v.id, note, oct, chord);
    });
  }, [engine]);

  const activeVoices = engine.voices.filter(v => v.active);

  return (
    <>
      {!started && <StartOverlay onStart={handleStart} />}

      <AmbientBackground voices={engine.voices} />

      <div className="relative min-h-screen flex flex-col" style={{ zIndex: 1 }}>
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(o => !o)} className="text-white/20 hover:text-white/50 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="4" width="12" height="1" fill="currentColor" rx="0.5"/>
                <rect x="2" y="7.5" width="12" height="1" fill="currentColor" rx="0.5"/>
                <rect x="2" y="11" width="12" height="1" fill="currentColor" rx="0.5"/>
              </svg>
            </button>
            <h1 className="font-cal text-lg text-white/90 tracking-tight">Polychromia</h1>
            <div className="w-px h-3.5 bg-white/10" />
            <span className="text-[10px] text-white/20 uppercase tracking-[0.2em]">
              {rootNote} · {chordType}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {activeVoices.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {activeVoices.map(v => (
                    <div key={v.id} className="w-1 h-3 rounded-full animate-pulse"
                      style={{ background: v.color, animationDelay: `${Math.random() * 1}s` }} />
                  ))}
                </div>
                <span className="text-[10px] text-white/25 uppercase tracking-widest">
                  {activeVoices.length} playing
                </span>
              </div>
            )}

            {engine.isRecording && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: 'rgba(212,121,106,0.1)', border: '1px solid rgba(212,121,106,0.25)' }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#d4796a' }} />
                <span className="text-[9px] uppercase tracking-widest" style={{ color: '#d4796a' }}>Rec</span>
              </div>
            )}
          </div>
        </header>

        {/* Visualizer strip */}
        <div className="px-6 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <Visualizer voices={engine.voices} height={48} />
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          {sidebarOpen && (
            <aside className="w-64 flex-shrink-0 overflow-y-auto p-5"
              style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
              <MasterControls
                rootNote={rootNote} setRootNote={setRootNote}
                octave={octave} setOctave={setOctave}
                chordType={chordType} setChordType={setChordType}
                masterVolume={engine.masterVolume} setMasterVolume={engine.setMasterVolume}
                isRecording={engine.isRecording}
                onStartRecording={engine.startRecording}
                onStopRecording={engine.stopRecording}
                voices={engine.voices}
                onRefreshAll={handleRefreshAll}
              />
            </aside>
          )}

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="flex px-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {PANELS.map(panel => (
                <button
                  key={panel}
                  onClick={() => setActivePanel(panel)}
                  className="px-4 py-3 text-[10px] uppercase tracking-[0.15em] transition-all relative"
                  style={{ color: activePanel === panel ? '#ffffff' : 'rgba(255,255,255,0.25)' }}
                >
                  {PANEL_LABELS[panel]}
                  {activePanel === panel && (
                    <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: '#b8d4c8' }} />
                  )}
                  {panel === 'radio' && engine.radioSamplers.length > 0 && (
                    <span className="ml-1.5 text-[8px] px-1 rounded" style={{ background: 'rgba(184,212,200,0.2)', color: '#b8d4c8' }}>
                      {engine.radioSamplers.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">
              {activePanel === 'voices' && (
                <div className="p-6 space-y-6 max-w-2xl">
                  <VoicePicker onAdd={handleAddVoice} />

                  {engine.voices.length > 0 ? (
                    <div className="space-y-3">
                      <div className="text-[10px] text-white/20 uppercase tracking-widest pb-1">
                        {engine.voices.length} voice{engine.voices.length !== 1 ? 's' : ''} · tap shape to toggle
                      </div>
                      {engine.voices.map(voice => (
                        <VoiceCard
                          key={voice.id}
                          voice={voice}
                          onToggle={() => handleToggleVoice(voice.id)}
                          onRemove={() => engine.removeVoice(voice.id)}
                          onUpdateParam={(key, val) => engine.updateVoiceParam(voice.id, key, val)}
                          onUpdateEffect={(key, val) => engine.updateVoiceEffects(voice.id, key, val)}
                          onColorApply={(hsl, hex) => engine.applyColorToVoice(voice.id, hsl, hex)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="text-white/10 text-4xl mb-4">○</div>
                      <div className="text-white/20 text-sm" style={{ fontWeight: 200 }}>
                        Choose a voice shape above to begin
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activePanel === 'radio' && (
                <div className="p-6 max-w-xl h-full flex flex-col">
                  <div className="text-[10px] text-white/20 uppercase tracking-widest mb-4">
                    Global Radio Streams
                  </div>
                  <RadioPanel
                    samplers={engine.radioSamplers}
                    onAdd={engine.addRadioSampler}
                    onToggle={engine.toggleRadioSampler}
                    onVolumeChange={engine.updateSamplerVolume}
                    onRemove={engine.removeRadioSampler}
                  />
                </div>
              )}

              {activePanel === 'colour' && (
                <div className="p-6 max-w-xs">
                  <div className="text-[10px] text-white/20 uppercase tracking-widest mb-4">
                    Colour → Sound
                  </div>
                  <ColorMapper
                    voices={engine.voices}
                    onApplyColor={(id, hsl, hex) => engine.applyColorToVoice(id, hsl, hex)}
                  />
                </div>
              )}

              {activePanel === 'about' && (
                <div className="p-6 max-w-md space-y-8">
                  <div>
                    <h2 className="font-cal text-2xl text-white/90 mb-3">Polychromia</h2>
                    <p className="text-white/30 text-sm leading-relaxed" style={{ fontWeight: 200 }}>
                      A browser-based drone and ambient music studio. Layer synthesised voices, live radio streams from across the world, and let colour guide the sound.
                    </p>
                  </div>

                  <div>
                    <div className="text-[10px] text-white/20 uppercase tracking-widest mb-4">Voice Shapes</div>
                    <div className="space-y-3">
                      {[
                        { shape: '○', name: 'Sine',     desc: 'Pure, smooth, foundational drone. The simplest waveform.' },
                        { shape: '△', name: 'Triangle', desc: 'Warm overtones, softer than sawtooth, gentle and woody.' },
                        { shape: '□', name: 'Sawtooth', desc: 'Rich harmonic content. Lush pad-like layers when detuned.' },
                        { shape: '◇', name: 'Square',   desc: 'Hollow, nasal — clarinet-like. Only odd harmonics.' },
                        { shape: '⬡', name: 'FM',       desc: 'Frequency modulation. Metallic, bell-like, evolving textures.' },
                        { shape: '⬠', name: 'AM',       desc: 'Amplitude modulation. Trembling, breathing, organic.' },
                        { shape: '★', name: 'Granular', desc: 'Multi-oscillator clouds with LFO modulation. Textured shimmer.' },
                        { shape: '◉', name: 'Pad',      desc: 'Stacked sine layers. Warm, lush, orchestral.' },
                      ].map(({ shape, name, desc }) => (
                        <div key={name} className="flex gap-4 items-start">
                          <div className="text-white/30 font-cal text-base w-6 text-center flex-shrink-0 mt-0.5">{shape}</div>
                          <div>
                            <div className="text-white/60 text-xs mb-0.5">{name}</div>
                            <div className="text-white/20 text-xs leading-relaxed" style={{ fontWeight: 200 }}>{desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
                    <div className="text-[10px] text-white/20 uppercase tracking-widest mb-3">Colour → Sound</div>
                    <p className="text-white/25 text-xs leading-relaxed" style={{ fontWeight: 200 }}>
                      Warm hues (reds, ambers, oranges) close the filter, adding darkness and warmth. Cool hues (blues, greens) open the filter bright and clear. Saturation increases modulation and chorus depth. Lightness maps to volume.
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
                    <div className="text-[10px] text-white/20 uppercase tracking-widest mb-3">Radio Streams</div>
                    <p className="text-white/25 text-xs leading-relaxed" style={{ fontWeight: 200 }}>
                      Browse thousands of global radio stations via the open Radio Browser directory. Layer streams alongside synthesised voices — each passes through reverb before joining the mix.
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
                    <div className="text-[10px] text-white/20 uppercase tracking-widest mb-3">Recording</div>
                    <p className="text-white/25 text-xs leading-relaxed" style={{ fontWeight: 200 }}>
                      The entire mix — voices, effects, radio streams — is captured by the Web Audio API recorder. Export as WAV for lossless quality.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
