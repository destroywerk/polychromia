import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGraph } from './graph/useGraph';
import { Canvas } from './components/canvas/Canvas';
import { NodePalette } from './components/panels/NodePalette';
import { Transport } from './components/panels/Transport';
import { Mixer } from './components/panels/Mixer';
import { HamburgerButton } from './components/ui/icons';
import { imageToPatch } from './utils/imageToPatch';
import polyWave from './assets/polychromia-wave.png';

function StartOverlay({ onStart }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at center, #0d0d11 0%, #060608 72%)' }}>
      <div className="relative flex flex-col" style={{ width: 520 }}>
        {/* Animated wave mark + wordmark — the wave overhangs to the left while the
            title overlaps its trailing crest, mirroring the mark. */}
        <div className="flex items-center justify-end">
          <img
            src={polyWave}
            alt=""
            aria-hidden="true"
            draggable="false"
            className="wave-anim select-none"
            style={{ height: 232, width: 'auto', marginLeft: -150, marginRight: -46 }}
          />
          <h1 className="font-cal text-white tracking-tight leading-none relative z-10" style={{ fontSize: 66 }}>
            Polychromia
          </h1>
        </div>

        {/* Divider — 0.5px, 40% */}
        <div className="mt-6" style={{ width: 520, height: '0.5px', background: 'rgba(255,255,255,0.4)' }} />

        {/* Subtext (left, 50%) + Enter studio (right) */}
        <div className="mt-8 flex items-start justify-between gap-10">
          <p className="leading-relaxed" style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, maxWidth: 296, color: 'rgba(255,255,255,0.5)', marginTop: -4 }}>
            Form as sound. Upload an image to translate it into audio. Patch oscillators, sequencers, and radio streams together on a modular canvas and shape with effects &amp; motion.
          </p>

          <button onClick={onStart}
            className="ctl shrink-0 h-[58px] w-[172px] rounded-lg flex items-center justify-center">
            <span className="ui-value" style={{ fontSize: 20 }}>Enter studio</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-8">
        <div style={{ width: 520 }}>
          <div style={{ width: '100%', height: '0.5px', background: 'rgba(255,255,255,0.4)', marginBottom: 14 }} />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Made by{' '}
            <a href="https://timgreen.design/" target="_blank" rel="noopener noreferrer"
              className="no-underline hover:underline" style={{ color: 'inherit' }}>
              Tim Green
            </a>
            . 2026.
          </p>
        </div>
      </div>
    </div>
  );
}

function MobileLanding() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'radial-gradient(ellipse at top, #0d0d11 0%, #060608 72%)' }}>
      <div className="px-6 pt-16">
        {/* Wave mark + wordmark */}
        <div className="flex items-center justify-end">
          <img
            src={polyWave}
            alt=""
            aria-hidden="true"
            draggable="false"
            className="wave-anim select-none"
            style={{ height: 150, width: 'auto', marginLeft: -70, marginRight: -30 }}
          />
          <h1 className="font-cal text-white tracking-tight leading-none relative z-10" style={{ fontSize: 40 }}>
            Polychromia
          </h1>
        </div>
        {/* Divider — 0.5px, 40% */}
        <div className="mt-4" style={{ width: '100%', height: '0.5px', background: 'rgba(255,255,255,0.4)' }} />
      </div>

      <div className="px-6 mt-12">
        <p className="text-white" style={{ fontFamily: 'Inter, sans-serif', fontSize: 17 }}>
          For now, Polychromia only works on desktop.
        </p>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-8">
        <div style={{ width: '100%', height: '0.5px', background: 'rgba(255,255,255,0.4)', marginBottom: 14 }} />
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          Made by{' '}
          <a href="https://timgreen.design/" target="_blank" rel="noopener noreferrer"
            className="no-underline hover:underline" style={{ color: 'inherit' }}>
            Tim Green
          </a>
          . 2026.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const graph = useGraph();
  const [started, setStarted] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [mixerExpanded, setMixerExpanded] = useState(true);
  const [transportCollapsed, setTransportCollapsed] = useState(false);
  const [mixerCollapsed, setMixerCollapsed] = useState(false);
  const cascade = useRef(0);
  const viewportRef = useRef({ pan: { x: 80, y: 40 }, scale: 1 });

  // The modular studio is desktop-only by design; small screens get a landing.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleStart = async () => { await graph.init(); setStarted(true); };

  // World-space point at (roughly) the centre of the visible canvas, excluding
  // the left palette and the right control column, accounting for pan + zoom.
  // Returns the top-left for a node so the node body lands centred on the point,
  // with a small cascade so consecutive adds don't perfectly overlap.
  const spawnPoint = useCallback(() => {
    const { pan, scale } = viewportRef.current;
    const leftOcc = paletteOpen ? 288 : 24;
    const rightOcc = ((mixerExpanded && !mixerCollapsed) ? 320 : 240) + 24;
    const cx = (leftOcc + (window.innerWidth - rightOcc)) / 2;
    const cy = Math.max(140, window.innerHeight * 0.42);
    const i = cascade.current++;
    const jitter = (i % 6) * 26;
    const wx = (cx - pan.x) / scale + jitter;
    const wy = (cy - pan.y) / scale + jitter;
    return { x: Math.round(wx - 110), y: Math.round(wy - 70) };
  }, [paletteOpen, mixerExpanded, mixerCollapsed]);

  const handleAdd = useCallback((type) => {
    const { x, y } = spawnPoint();
    graph.addNode(type, x, y);
  }, [graph, spawnPoint]);

  // Photo → Patch: analyse an uploaded image and spawn a series of oscillator
  // voices whose params are derived from its colours & shapes. The new nodes
  // auto-route to master (and start immediately if the transport is playing).
  const handleImportImage = useCallback(async (file) => {
    if (!file) return;
    if (!graph.initialized) await graph.init();
    let result = { voices: [], effects: [] };
    try { result = await imageToPatch(file, { maxVoices: 5 }); }
    catch (e) { console.warn('image import failed', e); return; }
    const { voices = [], effects = [] } = result;
    if (!voices.length) return;
    // Anchor the import inside the currently visible region.
    const origin = spawnPoint();

    // Build the effect chain to the right of the generator grid: each effect
    // feeds the next, the last (a reverb) terminates into master. The first
    // effect is the fan-in point for every generated voice.
    const fxX = origin.x + 3 * 250;
    let prevFxId = null;
    let firstFxId = null;
    effects.forEach((fx, i) => {
      const id = graph.addNode(fx.type, fxX, origin.y + i * 150);
      if (!id) return;
      Object.entries(fx.params).forEach(([key, val]) => graph.updateParam(id, key, val));
      if (i === 0) firstFxId = id;
      if (prevFxId) graph.addConnection({ node: prevFxId, port: 'out', kind: 'audio' }, { node: id, port: 'in', kind: 'audio' });
      prevFxId = id;
    });

    // Spread voices across a non-overlapping grid (node width ~230) and fan each
    // into the head of the effect chain (multiple audio cables into one input
    // are allowed). With no effects, voices route to master directly.
    voices.forEach((v, i) => {
      const col = i % 3;
      const rown = Math.floor(i / 3);
      const x = origin.x + col * 250;
      const y = origin.y + rown * 220 + col * 24;
      const id = graph.addNode(v.type, x, y);
      if (!id) return;
      Object.entries(v.params).forEach(([key, val]) => graph.updateParam(id, key, val));
      if (firstFxId) graph.addConnection({ node: id, port: 'out', kind: 'audio' }, { node: firstFxId, port: 'in', kind: 'audio' });
    });
  }, [graph, spawnPoint]);

  if (isMobile) return <MobileLanding />;

  return (
    <>
      {!started && <StartOverlay onStart={handleStart} />}

      <div className="fixed inset-0">
        <Canvas graph={graph} viewportRef={viewportRef} />

        {/* Palette toggle — floats only when the palette is collapsed; when open
            it lives inside the panel header (see NodePalette). */}
        {!paletteOpen && (
          <HamburgerButton onClick={() => setPaletteOpen(true)} title="Open panel"
            className="absolute top-4 left-4 z-30" />
        )}

        <NodePalette onAdd={handleAdd} onImportImage={handleImportImage} open={paletteOpen}
          onToggle={() => setPaletteOpen(false)} />

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
            recError={graph.recError} onClearRecError={graph.clearRecError}
            engine={graph.engine}
            globalKey={graph.globalKey} onGlobalKey={graph.setGlobalKey}
            globalColour={graph.globalColour} onGlobalColour={graph.setGlobalColour}
            onRandomise={graph.randomiseAll} onClear={graph.clearAll}
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
            <img src={polyWave} alt="" aria-hidden="true" draggable="false"
              className="wave-anim mx-auto mb-6 select-none" style={{ height: 72, width: 'auto', opacity: 0.6 }} />
            <div className="ui-label" style={{ fontSize: 16 }}>Add a node from the left panel to begin patching</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
