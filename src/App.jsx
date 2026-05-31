import React, { useState, useCallback, useRef } from 'react';
import { useGraph } from './graph/useGraph';
import { Canvas } from './components/canvas/Canvas';
import { NodePalette } from './components/panels/NodePalette';
import { Transport } from './components/panels/Transport';
import { Mixer } from './components/panels/Mixer';
import { imageToPatch } from './utils/imageToPatch';

function StartOverlay({ onStart }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at center, #101016 0%, #08080a 70%)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #8fbaa9 0%, transparent 70%)', filter: 'blur(70px)', animation: 'breathe 7s ease-in-out infinite' }} />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #9a93d4 0%, transparent 70%)', filter: 'blur(60px)', animation: 'breathe 9s ease-in-out infinite 2s' }} />
        <div className="absolute top-1/2 right-1/3 w-56 h-56 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #d48fb0 0%, transparent 70%)', filter: 'blur(50px)', animation: 'breathe 11s ease-in-out infinite 1s' }} />
      </div>
      <div className="relative text-center space-y-8 px-8">
        <div>
          <h1 className="font-cal text-7xl text-white tracking-tight mb-3">Polychromia</h1>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-white/10" />
            <span className="text-[10px] text-white/30 uppercase tracking-[0.35em]">Modular Drone & Ambient Studio</span>
            <div className="h-px w-10 bg-white/10" />
          </div>
        </div>
        <p className="text-white/30 text-sm leading-relaxed font-inter mx-auto" style={{ maxWidth: 380 }}>
          Patch oscillators, sequencers, loopers and radio streams together on a modular canvas. Shape everything with effects, modulation and motion.
        </p>
        <button onClick={onStart}
          className="block w-52 mx-auto py-3 rounded-full text-xs uppercase tracking-[0.25em] transition-all hover:opacity-90"
          style={{ background: 'rgba(143,186,169,0.14)', border: '1px solid rgba(143,186,169,0.35)', color: '#8fbaa9' }}>
          Enter Studio
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const graph = useGraph();
  const [started, setStarted] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [mixerExpanded, setMixerExpanded] = useState(false);
  const [transportCollapsed, setTransportCollapsed] = useState(false);
  const [mixerCollapsed, setMixerCollapsed] = useState(false);
  const cascade = useRef(0);

  const handleStart = async () => { await graph.init(); setStarted(true); };

  const handleAdd = useCallback((type) => {
    const i = cascade.current++;
    const x = 150 + (i % 4) * 248;
    const y = 80 + Math.floor(i / 4) * 250 + (i % 4) * 26;
    graph.addNode(type, x, y);
  }, [graph]);

  // Photo → Patch: analyse an uploaded image and spawn a series of oscillator
  // voices whose params are derived from its colours & shapes. The new nodes
  // auto-route to master (and start immediately if the transport is playing).
  const handleImportImage = useCallback(async (file) => {
    if (!file) return;
    if (!graph.initialized) await graph.init();
    let voices = [];
    try { voices = await imageToPatch(file, { maxVoices: 5 }); }
    catch (e) { console.warn('image import failed', e); return; }
    if (!voices.length) return;
    // Spawn a shared reverb to glue the imported voices into one cohesive,
    // evolving wash, then fan every voice into it.
    const reverbId = graph.addNode('reverb', 320 + 3 * 250, 160);
    if (reverbId) {
      graph.updateParam(reverbId, 'decay', 7);
      graph.updateParam(reverbId, 'wet', 0.5);
    }
    // Spread voices across the canvas in a non-overlapping grid (node width ~210).
    // Each voice is a typed generator (grain / drift / noise / oscillator) chosen
    // from the image; spawn that type and apply only its valid params.
    voices.forEach((v, i) => {
      const col = i % 3;
      const rown = Math.floor(i / 3);
      const x = 300 + col * 250;
      const y = 110 + rown * 220 + col * 24;
      const { type, ...params } = v;
      const id = graph.addNode(type, x, y);
      if (!id) return;
      Object.entries(params).forEach(([key, val]) => graph.updateParam(id, key, val));
      if (reverbId) graph.addConnection({ node: id, port: 'out', kind: 'audio' }, { node: reverbId, port: 'in', kind: 'audio' });
    });
  }, [graph]);

  return (
    <>
      {!started && <StartOverlay onStart={handleStart} />}

      <div className="fixed inset-0">
        <Canvas graph={graph} />

        {/* Palette toggle */}
        <button onClick={() => setPaletteOpen((o) => !o)}
          className="absolute top-3 z-30 w-9 h-9 rounded-lg flex items-center justify-center transition-all"
          style={{ left: paletteOpen ? 232 : 12, background: 'rgba(16,16,19,0.9)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="3" width="10" height="1" rx="0.5" fill="currentColor" />
            <rect x="2" y="6.5" width="10" height="1" rx="0.5" fill="currentColor" />
            <rect x="2" y="10" width="10" height="1" rx="0.5" fill="currentColor" />
          </svg>
        </button>

        <NodePalette onAdd={handleAdd} onImportImage={handleImportImage} open={paletteOpen} />

        {/* Right cluster: transport + mixer. The column itself ignores pointer
            events so the canvas stays draggable behind any empty space; only the
            panels capture input. */}
        <div className="absolute top-3 right-3 bottom-3 flex flex-col gap-3 z-20 overflow-y-auto no-select pointer-events-none [&>*]:pointer-events-auto"
          style={{ width: (mixerExpanded && !mixerCollapsed) ? 320 : 240, transition: 'width 0.18s ease' }}>
          <Transport
            playing={graph.playing}
            onPlay={graph.play} onPause={graph.pause} onStop={graph.stop}
            bpm={graph.bpm} onBpm={graph.setBpm}
            masterVolume={graph.masterVolume} onMasterVolume={graph.setMasterVolume}
            isRecording={graph.isRecording} onStartRec={graph.startRecording} onStopRec={graph.stopRecording}
            engine={graph.engine}
            globalKey={graph.globalKey} onGlobalKey={graph.setGlobalKey} onRandomise={graph.randomiseAll}
            collapsed={transportCollapsed} onToggleCollapse={() => setTransportCollapsed((c) => !c)}
          />
          <Mixer
            nodes={graph.nodes} updateParam={graph.updateParam} engine={graph.engine}
            setNodeEnabled={graph.setNodeEnabled} setMute={graph.setMute} setSolo={graph.setSolo}
            expanded={mixerExpanded} onToggleExpand={() => setMixerExpanded((e) => !e)}
            collapsed={mixerCollapsed} onToggleCollapse={() => setMixerCollapsed((c) => !c)}
          />
        </div>

        {/* Empty hint */}
        {graph.nodes.length === 0 && started && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-white/10 text-5xl mb-3 font-cal">∿</div>
              <div className="text-white/25 text-sm font-inter">Add a node from the left panel to begin patching</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
