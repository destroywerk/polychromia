import React, { useState, useCallback, useRef } from 'react';
import { useGraph } from './graph/useGraph';
import { Canvas } from './components/canvas/Canvas';
import { NodePalette } from './components/panels/NodePalette';
import { Transport } from './components/panels/Transport';
import { Mixer } from './components/panels/Mixer';
import { HamburgerButton } from './components/ui/icons';
import { imageToPatch } from './utils/imageToPatch';
import polyMark from './assets/polychromia-mark.png';

function StartOverlay({ onStart }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at center, #101016 0%, #08080a 70%)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #8fbaa9 0%, transparent 70%)', filter: 'blur(70px)', animation: 'breathe 7s ease-in-out infinite' }} />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #9a93d4 0%, transparent 70%)', filter: 'blur(60px)', animation: 'breathe 9s ease-in-out infinite 2s' }} />
        <div className="absolute top-1/2 right-1/3 w-56 h-56 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #d48fb0 0%, transparent 70%)', filter: 'blur(50px)', animation: 'breathe 11s ease-in-out infinite 1s' }} />
      </div>
      <div className="relative flex flex-col items-center text-center px-6">
        {/* Mark + wordmark */}
        <div className="flex items-center gap-6">
          <img src={polyMark} alt="" aria-hidden="true" className="w-[132px] h-[132px] object-contain" draggable="false" />
          <h1 className="font-cal text-white tracking-tight leading-none" style={{ fontSize: 70 }}>Polychromia</h1>
        </div>

        {/* Divider — 0.5px, 40% */}
        <div className="mt-10" style={{ width: 564, height: '0.5px', background: 'rgba(255,255,255,0.4)' }} />

        {/* Subtext — 50% */}
        <p className="mt-7 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, maxWidth: 564, color: 'rgba(255,255,255,0.5)' }}>
          Form as sound. Upload an image to translate it into audio. Patch oscillators, sequencers, and radio streams together on a modular canvas and shape with effects &amp; motion.
        </p>

        <button onClick={onStart}
          className="ctl mt-9 h-[58px] w-[192px] rounded-lg flex items-center justify-center">
          <span className="ui-value" style={{ fontSize: 20 }}>Enter studio</span>
        </button>
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
            globalKey={graph.globalKey} onGlobalKey={graph.setGlobalKey} onRandomise={graph.randomiseAll} onClear={graph.clearAll}
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
            <div className="text-white/10 text-8xl mb-5 font-cal">∿</div>
            <div className="ui-label" style={{ fontSize: 16 }}>Add a node from the left panel to begin patching</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
