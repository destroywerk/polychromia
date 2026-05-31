import React, { useEffect, useRef } from 'react';
import { Stepper } from '../ui/Controls';
import { NOTES } from '../../engine/theory';

const KEY_CHORDS = ['Root', '5', 'add9', 'maj7', 'min7', 'm11', 'sus2', 'maj9'];

function Scope({ engine }) {
  const canvasRef = useRef(null);
  const raf = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const draw = () => {
      raf.current = requestAnimationFrame(draw);
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const data = engine.getWaveform?.();
      if (!data) return;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(143,186,169,0.5)';
      ctx.lineWidth = 1;
      const slice = W / data.length;
      for (let i = 0; i < data.length; i++) {
        const y = (0.5 - data[i] * 0.45) * H;
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * slice, y);
      }
      ctx.stroke();
    };
    draw();
    return () => cancelAnimationFrame(raf.current);
  }, [engine]);
  return <canvas ref={canvasRef} width={206} height={34} className="w-full rounded" style={{ display: 'block', opacity: 0.6 }} />;
}

export function Transport({ playing, onPlay, onPause, onStop, bpm, onBpm, masterVolume, onMasterVolume, isRecording, onStartRec, onStopRec, engine, globalKey, onGlobalKey, onRandomise }) {
  const bpmDrag = useRef(null);
  const onBpmDown = (e) => {
    bpmDrag.current = { y: e.clientY, v: bpm };
    const move = (ev) => { const d = bpmDrag.current.y - ev.clientY; onBpm(Math.max(20, Math.min(200, Math.round(bpmDrag.current.v + d * 0.5)))); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(16,16,19,0.85)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
      <Scope engine={engine} />

      {/* Transport buttons */}
      <div className="flex items-center gap-2">
        {!playing ? (
          <button onClick={onPlay} className="flex-1 py-2 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'rgba(143,186,169,0.15)', border: '1px solid rgba(143,186,169,0.4)', color: '#8fbaa9' }}>
            <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="2,1 11,6 2,11" fill="currentColor" /></svg>
          </button>
        ) : (
          <button onClick={onPause} className="flex-1 py-2 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'rgba(154,147,212,0.15)', border: '1px solid rgba(154,147,212,0.4)', color: '#9a93d4' }}>
            <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="1" width="3" height="10" fill="currentColor" /><rect x="7" y="1" width="3" height="10" fill="currentColor" /></svg>
          </button>
        )}
        <button onClick={onStop} className="flex-1 py-2 rounded-lg flex items-center justify-center transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
          <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="1" width="9" height="9" rx="1" fill="currentColor" /></svg>
        </button>
      </div>

      {/* BPM + Master */}
      <div className="flex items-center gap-3">
        <div onPointerDown={onBpmDown} className="flex-1 rounded-lg px-3 py-1.5 cursor-ns-resize no-select" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[8px] text-white/30 uppercase tracking-[0.15em]">BPM</div>
          <div className="font-cal text-lg text-white/85 leading-none">{bpm}</div>
        </div>
        <div className="flex-1">
          <div className="text-[8px] text-white/30 uppercase tracking-[0.15em] mb-1">Master</div>
          <input type="range" min={0} max={1} step={0.01} value={masterVolume} onChange={(e) => onMasterVolume(parseFloat(e.target.value))} className="w-full" style={{ accentColor: '#8fbaa9' }} />
        </div>
      </div>

      {/* Global key + randomise */}
      {globalKey && onGlobalKey && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <div className="text-[8px] text-white/30 uppercase tracking-[0.15em] mb-1">Key</div>
            <div className="flex items-center gap-1">
              <Stepper value={globalKey.root} onChange={(v) => onGlobalKey({ ...globalKey, root: v })} options={NOTES} accent="#8fbaa9" />
              <Stepper value={globalKey.chord} onChange={(v) => onGlobalKey({ ...globalKey, chord: v })} options={KEY_CHORDS} accent="#8fbaa9" wide />
            </div>
          </div>
        </div>
      )}
      {onRandomise && (
        <button onClick={onRandomise} className="w-full py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] transition-all hover:opacity-90"
          style={{ background: 'rgba(154,147,212,0.1)', border: '1px solid rgba(154,147,212,0.35)', color: '#9a93d4' }}>
          ⤨ Randomise All
        </button>
      )}

      {/* Record */}
      {isRecording ? (
        <button onClick={onStopRec} className="w-full py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2"
          style={{ background: 'rgba(217,122,106,0.15)', border: '1px solid rgba(217,122,106,0.5)', color: '#d97a6a' }}>
          <span className="w-2 h-2 rounded-sm bg-current animate-pulse" /> Stop & Export WAV
        </button>
      ) : (
        <button onClick={onStartRec} className="w-full py-2 rounded-lg text-[10px] uppercase tracking-[0.15em]"
          style={{ background: 'rgba(217,122,106,0.06)', border: '1px solid rgba(217,122,106,0.25)', color: 'rgba(217,122,106,0.8)' }}>
          ● Record Mix
        </button>
      )}
    </div>
  );
}
