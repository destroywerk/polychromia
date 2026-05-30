import React, { useState } from 'react';
import { NOTES, CHORD_TYPES } from '../engine/audioEngine';

export function MasterControls({
  rootNote, setRootNote,
  octave, setOctave,
  chordType, setChordType,
  masterVolume, setMasterVolume,
  isRecording, onStartRecording, onStopRecording,
  voices, onRefreshAll,
}) {
  const [exportFormat, setExportFormat] = useState('wav');
  const activeCount = voices.filter(v => v.active).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Key + Octave */}
      <div>
        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Key</div>
        <div className="flex flex-wrap gap-1.5">
          {NOTES.map(n => (
            <button
              key={n}
              onClick={() => { setRootNote(n); onRefreshAll(n, octave, chordType); }}
              className="w-8 h-8 rounded-lg text-xs transition-all"
              style={{
                background: rootNote === n ? '#b8d4c8' : '#18181c',
                color: rootNote === n ? '#0a0a0b' : '#666',
                border: rootNote === n ? '1px solid #b8d4c8' : '1px solid #222228',
                fontFamily: 'Cal Sans, sans-serif',
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-3 items-center">
          <span className="text-[10px] text-white/30 uppercase tracking-widest">Octave</span>
          {[1, 2, 3, 4, 5].map(o => (
            <button
              key={o}
              onClick={() => { setOctave(o); onRefreshAll(rootNote, o, chordType); }}
              className="w-7 h-7 rounded-lg text-xs transition-all"
              style={{
                background: octave === o ? '#c4b8d4' : '#18181c',
                color: octave === o ? '#0a0a0b' : '#666',
                border: octave === o ? '1px solid #c4b8d4' : '1px solid #222228',
              }}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {/* Chord */}
      <div>
        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Chord</div>
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {Object.keys(CHORD_TYPES).map(ct => (
            <button
              key={ct}
              onClick={() => { setChordType(ct); onRefreshAll(rootNote, octave, ct); }}
              className="py-1.5 px-2 rounded-lg text-[11px] text-left transition-all"
              style={{
                background: chordType === ct ? '#d4b8c422' : '#18181c',
                color: chordType === ct ? '#d4b8c4' : '#666',
                border: chordType === ct ? '1px solid #d4b8c444' : '1px solid #222228',
              }}
            >
              {ct}
            </button>
          ))}
        </div>
      </div>

      {/* Master volume */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="text-[10px] text-white/30 uppercase tracking-widest">Master Volume</div>
          <div className="text-[10px] text-white/30">{Math.round(masterVolume * 100)}%</div>
        </div>
        <input
          type="range" min={0} max={1} step={0.01} value={masterVolume}
          onChange={e => setMasterVolume(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Status */}
      {activeCount > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" style={{ background: '#b8d4c8' }} />
          <span className="text-[11px] text-white/40">{activeCount} voice{activeCount !== 1 ? 's' : ''} playing</span>
        </div>
      )}

      {/* Recording */}
      <div className="border-t border-white/5 pt-4">
        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Record & Export</div>
        <div className="flex gap-2 mb-3">
          {['wav', 'mp3'].map(f => (
            <button
              key={f}
              onClick={() => setExportFormat(f)}
              className="flex-1 py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition-all"
              style={{
                background: exportFormat === f ? '#d4cbb822' : 'transparent',
                color: exportFormat === f ? '#d4cbb8' : '#444',
                border: exportFormat === f ? '1px solid #d4cbb844' : '1px solid #222228',
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        {isRecording ? (
          <button
            onClick={() => onStopRecording(exportFormat)}
            className="w-full py-2.5 rounded-lg text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            style={{ background: '#d4796a22', border: '1px solid #d4796a44', color: '#d4796a' }}
          >
            <span className="w-2 h-2 rounded-sm bg-current animate-pulse" />
            Stop & Export
          </button>
        ) : (
          <button
            onClick={onStartRecording}
            className="w-full py-2.5 rounded-lg text-xs uppercase tracking-widest transition-all"
            style={{ background: '#d4796a11', border: '1px solid #d4796a33', color: '#d4796a88' }}
          >
            Start Recording
          </button>
        )}
      </div>
    </div>
  );
}
