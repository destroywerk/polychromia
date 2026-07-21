import React, { useState } from 'react';
import { Stepper } from '../ui/Controls';
import { NOTES } from '../../engine/theory';

const KEY_CHORDS = ['Root', '5', 'add9', 'maj7', 'min7', 'm11', 'sus2', 'maj9'];
const BPM_OPTIONS = Array.from({ length: 181 }, (_, i) => 20 + i);

// Visible filled slider track (sage up to the value), matching the mixer sliders.
const trackFill = (pct) =>
  `linear-gradient(to right, #8fbaa9 0%, #8fbaa9 ${pct}%, #2c2c34 ${pct}%, #2c2c34 100%) center / 100% 4px no-repeat`;

function MiniPlay({ playing, onPlay, onPause }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); playing ? onPause() : onPlay(); }} title={playing ? 'Pause' : 'Play'}
      className="btn-accent w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#98b9aa', color: '#0b0b0d' }}>
      {playing
        ? <svg width="9" height="9" viewBox="0 0 12 12"><rect x="2" y="1" width="3" height="10" fill="currentColor" /><rect x="7" y="1" width="3" height="10" fill="currentColor" /></svg>
        : <svg width="9" height="9" viewBox="0 0 12 12"><polygon points="2,1 11,6 2,11" fill="currentColor" /></svg>}
    </button>
  );
}

export function Transport({ playing, onPlay, onPause, onStop, bpm, onBpm, masterVolume, onMasterVolume, isRecording, onStartRec, onStopRec, recError, onClearRecError, engine, globalKey, onGlobalKey, onRandomise, onClear, collapsed, onToggleCollapse }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const panelStyle = { background: 'rgba(25,28,32,0.6)', border: '0.5px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(12px)' };

  if (collapsed) {
    return (
      <div className="rounded-lg px-3 py-2.5 flex items-center gap-2" style={panelStyle}>
        <div className="ui-label text-[9px] flex-1">Controls</div>
        <MiniPlay playing={playing} onPlay={onPlay} onPause={onPause} />
        <button onClick={onToggleCollapse} title="Expand" className="text-white/40 hover:text-white/80 leading-none" style={{ fontSize: 12 }}>⌄</button>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-3 space-y-3.5" style={panelStyle}>
      <div className="flex items-center justify-between">
        <div className="ui-label text-[9px]">Controls</div>
        <button onClick={onToggleCollapse} title="Collapse" className="text-white/40 hover:text-white/80 leading-none" style={{ fontSize: 12 }}>⌃</button>
      </div>

      {/* Transport buttons — play (solid sage) + stop (neutral) */}
      <div className="flex items-center gap-2">
        <button onClick={playing ? onPause : onPlay} className="btn-accent flex-1 h-10 rounded-lg flex items-center justify-center"
          style={{ background: '#98b9aa', color: '#0b0b0d' }}>
          {playing
            ? <svg width="13" height="13" viewBox="0 0 12 12"><rect x="2" y="1" width="3" height="10" fill="currentColor" /><rect x="7" y="1" width="3" height="10" fill="currentColor" /></svg>
            : <svg width="13" height="13" viewBox="0 0 12 12"><polygon points="2,1 11,6 2,11" fill="currentColor" /></svg>}
        </button>
        <button onClick={onStop} className="ctl ui-value flex-1 h-10 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 11 11"><rect x="1" y="1" width="9" height="9" rx="1" fill="currentColor" /></svg>
        </button>
      </div>

      {/* Master volume */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="ui-label">Master volume</span>
          <span className="ui-value">{Math.round(masterVolume * 100)}%</span>
        </div>
        <input type="range" min={0} max={1} step={0.01} value={masterVolume} onChange={(e) => onMasterVolume(parseFloat(e.target.value))}
          className="w-full mix-range" style={{ background: trackFill(masterVolume * 100) }} />
      </div>

      {/* Key + BPM steppers */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <div className="ui-label text-[9px] mb-1.5">Key</div>
          {globalKey && onGlobalKey ? (
            <div className="flex items-center gap-1">
              <Stepper value={globalKey.root} onChange={(v) => onGlobalKey({ ...globalKey, root: v })} options={NOTES} accent="#8fbaa9" height={30} />
              <Stepper value={globalKey.chord} onChange={(v) => onGlobalKey({ ...globalKey, chord: v })} options={KEY_CHORDS} accent="#8fbaa9" wide height={30} />
            </div>
          ) : (
            <div className="ui-value text-[11px] text-white/50">—</div>
          )}
        </div>
        <div>
          <div className="ui-label text-[9px] mb-1.5">BPM</div>
          <Stepper value={bpm} onChange={(v) => onBpm(v)} options={BPM_OPTIONS} accent="#8fbaa9" height={30} />
        </div>
      </div>

      {/* Randomise + Clear all */}
      {(onRandomise || onClear) && (
        <div className="flex items-center gap-2">
          {onRandomise && (
            <button onClick={onRandomise} className="ctl ui-value flex-1 h-[30px] rounded-lg text-[10px]">
              Randomise
            </button>
          )}
          {onClear && (
            <button onClick={() => setConfirmClear(true)} title="Delete all nodes"
              className="ctl-red ui-value h-[30px] px-4 rounded-lg text-[10px]" style={{ color: '#b3261e' }}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Record */}
      {isRecording ? (
        <button onClick={async () => { await onStopRec?.(); }} className="ctl-red ui-value w-full h-10 rounded-lg text-[10px] flex items-center justify-center gap-2">
          <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#b3261e' }} /> Stop &amp; export
        </button>
      ) : (
        <button onClick={async () => { onClearRecError?.(); await onStartRec?.(); }} className="ctl ui-value w-full h-10 rounded-lg text-[10px] flex items-center justify-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: '#b3261e' }} /> Record mix &amp; export .wav
        </button>
      )}
      {recError && (
        <div className="ui-label rounded-lg px-2.5 py-1.5 text-[9px] leading-snug flex items-start gap-1.5"
          style={{ background: 'rgba(179,38,30,0.1)', border: '0.5px solid #b3261e', color: '#e08b83' }}>
          <span className="flex-1">⚠ {recError}</span>
          <button onClick={() => onClearRecError?.()} className="opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setConfirmClear(false)}
          style={{ background: 'rgba(8,8,10,0.6)', backdropFilter: 'blur(5px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-2xl p-5 w-72"
            style={{ background: 'rgba(16,16,19,0.97)', border: '0.5px solid rgba(179,38,30,0.4)', boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}>
            <div className="font-cal text-sm text-white mb-1">Delete all nodes?</div>
            <div className="ui-label text-[11px] leading-snug mb-4">This can't be undone.</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmClear(false)} className="ctl ui-value flex-1 h-9 rounded-lg text-[10px]">
                Cancel
              </button>
              <button onClick={() => { onClear?.(); setConfirmClear(false); }} className="ctl-red ui-value flex-1 h-9 rounded-lg text-[10px]" style={{ color: '#b3261e' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
