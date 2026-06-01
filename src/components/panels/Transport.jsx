import React, { useEffect, useRef, useState } from 'react';
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

function MiniPlay({ playing, onPlay, onPause }) {
  return playing ? (
    <button onClick={(e) => { e.stopPropagation(); onPause(); }} title="Pause"
      className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(154,147,212,0.15)', border: '1px solid rgba(154,147,212,0.4)', color: '#9a93d4' }}>
      <svg width="9" height="9" viewBox="0 0 12 12"><rect x="2" y="1" width="3" height="10" fill="currentColor" /><rect x="7" y="1" width="3" height="10" fill="currentColor" /></svg>
    </button>
  ) : (
    <button onClick={(e) => { e.stopPropagation(); onPlay(); }} title="Play"
      className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(143,186,169,0.15)', border: '1px solid rgba(143,186,169,0.4)', color: '#8fbaa9' }}>
      <svg width="9" height="9" viewBox="0 0 12 12"><polygon points="2,1 11,6 2,11" fill="currentColor" /></svg>
    </button>
  );
}

export function Transport({ playing, onPlay, onPause, onStop, bpm, onBpm, masterVolume, onMasterVolume, isRecording, onStartRec, onStopRec, recError, onClearRecError, engine, globalKey, onGlobalKey, onRandomise, onClear, collapsed, onToggleCollapse }) {
  const bpmDrag = useRef(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const onBpmDown = (e) => {
    bpmDrag.current = { y: e.clientY, v: bpm };
    const move = (ev) => { const d = bpmDrag.current.y - ev.clientY; onBpm(Math.max(20, Math.min(200, Math.round(bpmDrag.current.v + d * 0.5)))); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const panelStyle = { background: 'rgba(16,16,19,0.85)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' };

  if (collapsed) {
    return (
      <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={panelStyle}>
        <div className="text-[9px] text-white/35 uppercase tracking-[0.18em] flex-1">Transport</div>
        <MiniPlay playing={playing} onPlay={onPlay} onPause={onPause} />
        <button onClick={onToggleCollapse} title="Expand" className="text-[9px] text-white/30 hover:text-white/70 leading-none" style={{ fontSize: 12 }}>⌄</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-3 space-y-3" style={panelStyle}>
      <div className="flex items-center justify-between">
        <div className="text-[9px] text-white/35 uppercase tracking-[0.18em]">Transport</div>
        <button onClick={onToggleCollapse} title="Collapse" className="text-[9px] text-white/30 hover:text-white/70 leading-none" style={{ fontSize: 12 }}>⌃</button>
      </div>
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
      {(onRandomise || onClear) && (
        <div className="flex items-center gap-2">
          {onRandomise && (
            <button onClick={onRandomise} className="flex-1 py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] transition-all hover:opacity-90"
              style={{ background: 'rgba(154,147,212,0.1)', border: '1px solid rgba(154,147,212,0.35)', color: '#9a93d4' }}>
              ⤨ Randomise
            </button>
          )}
          {onClear && (
            <button onClick={() => setConfirmClear(true)} title="Delete all nodes"
              className="py-2 px-3 rounded-lg text-[10px] uppercase tracking-[0.15em] transition-all hover:opacity-90"
              style={{ background: 'rgba(217,122,106,0.08)', border: '1px solid rgba(217,122,106,0.35)', color: '#d97a6a' }}>
              ⌫ Clear
            </button>
          )}
        </div>
      )}

      {/* Record */}
      {isRecording ? (
        <button onClick={async () => { await onStopRec?.(); }} className="w-full py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2"
          style={{ background: 'rgba(217,122,106,0.15)', border: '1px solid rgba(217,122,106,0.5)', color: '#d97a6a' }}>
          <span className="w-2 h-2 rounded-sm bg-current animate-pulse" /> Stop & Export
        </button>
      ) : (
        <button onClick={async () => { onClearRecError?.(); await onStartRec?.(); }} className="w-full py-2 rounded-lg text-[10px] uppercase tracking-[0.15em]"
          style={{ background: 'rgba(217,122,106,0.06)', border: '1px solid rgba(217,122,106,0.25)', color: 'rgba(217,122,106,0.8)' }}>
          ● Record Mix
        </button>
      )}
      {recError && (
        <div className="rounded-lg px-2.5 py-1.5 text-[9px] leading-snug flex items-start gap-1.5"
          style={{ background: 'rgba(217,122,106,0.1)', border: '1px solid rgba(217,122,106,0.35)', color: '#d97a6a' }}>
          <span className="flex-1">⚠ {recError}</span>
          <button onClick={() => onClearRecError?.()} className="opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setConfirmClear(false)}
          style={{ background: 'rgba(8,8,10,0.6)', backdropFilter: 'blur(5px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-2xl p-5 w-72"
            style={{ background: 'rgba(16,16,19,0.97)', border: '1px solid rgba(217,122,106,0.3)', boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}>
            <div className="font-cal text-sm text-white/90 mb-1">Delete all nodes?</div>
            <div className="text-[11px] text-white/40 leading-snug mb-4">This can't be undone.</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmClear(false)} className="flex-1 py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] transition-all hover:opacity-90"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                Cancel
              </button>
              <button onClick={() => { onClear?.(); setConfirmClear(false); }} className="flex-1 py-2 rounded-lg text-[10px] uppercase tracking-[0.15em] transition-all hover:opacity-90"
                style={{ background: 'rgba(217,122,106,0.18)', border: '1px solid rgba(217,122,106,0.55)', color: '#d97a6a' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
