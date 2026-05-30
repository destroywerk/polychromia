import React, { useState } from 'react';
import { VoiceShape } from './VoiceShape';
import { VOICE_TYPES } from '../engine/audioEngine';

const EFFECTS = [
  { key: 'reverb',     label: 'Reverb' },
  { key: 'delay',      label: 'Delay' },
  { key: 'chorus',     label: 'Chorus' },
  { key: 'filter',     label: 'Filter' },
  { key: 'distortion', label: 'Saturate' },
  { key: 'phaser',     label: 'Phaser' },
  { key: 'tremolo',    label: 'Tremolo' },
];

function Knob({ value, onChange, label, min = 0, max = 1 }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <input
        type="range" min={min} max={max} step={0.01} value={value ?? 0}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-16"
      />
      <span className="text-[9px] text-white/30 uppercase tracking-widest">{label}</span>
    </div>
  );
}

export function VoiceCard({ voice, onToggle, onRemove, onUpdateParam, onUpdateEffect, onColorApply }) {
  const [expanded, setExpanded] = useState(false);
  const voiceDef = VOICE_TYPES[voice.type];

  return (
    <div
      className="relative rounded-xl border transition-all duration-300"
      style={{
        borderColor: voice.active ? `${voice.color}55` : '#222228',
        background: voice.active ? `${voice.color}08` : '#111114',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <button onClick={onToggle} className="flex-shrink-0">
          <VoiceShape
            type={voiceDef?.shape || 'circle'}
            size={52}
            color={voice.colorHex ? voice.color : voice.color}
            active={voice.active}
            pulse
          />
        </button>

        <div className="flex-1 min-w-0">
          <div className="font-cal text-sm text-white/90">{voice.label}</div>
          <div className="text-[10px] text-white/30 mt-0.5 uppercase tracking-widest">
            {voice.active ? 'playing' : 'silent'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[10px] text-white/30 hover:text-white/60 uppercase tracking-widest px-2 py-1"
          >
            {expanded ? 'less' : 'more'}
          </button>
          <button
            onClick={onRemove}
            className="text-white/20 hover:text-red-400/60 text-lg leading-none pb-0.5"
          >
            ×
          </button>
        </div>
      </div>

      {/* Quick controls */}
      <div className="px-4 pb-3 flex gap-4">
        <div className="flex-1">
          <input
            type="range" min={0} max={1} step={0.01} value={voice.volume}
            onChange={e => onUpdateParam('volume', parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="text-[9px] text-white/25 uppercase tracking-widest mt-1">Vol</div>
        </div>
        <div className="flex-1">
          <input
            type="range" min={-1} max={1} step={0.01} value={voice.pan}
            onChange={e => onUpdateParam('pan', parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="text-[9px] text-white/25 uppercase tracking-widest mt-1">Pan</div>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 space-y-4">
          {/* Envelope */}
          <div>
            <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Envelope</div>
            <div className="flex gap-4">
              <Knob value={voice.attack} onChange={v => onUpdateParam('attack', v)} label="Attack" min={0.01} max={8} />
              <Knob value={voice.release} onChange={v => onUpdateParam('release', v)} label="Release" min={0.1} max={12} />
            </div>
          </div>

          {/* Effects */}
          <div>
            <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Effects</div>
            <div className="space-y-2">
              {EFFECTS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-[9px] text-white/25 uppercase tracking-widest w-16 flex-shrink-0">{label}</span>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={voice.effects[key] ?? 0}
                    onChange={e => onUpdateEffect(key, parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-[9px] text-white/20 w-7 text-right">
                    {Math.round((voice.effects[key] ?? 0) * 100)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active glow bar */}
      {voice.active && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl"
          style={{ background: `linear-gradient(90deg, transparent, ${voice.color}88, transparent)` }}
        />
      )}
    </div>
  );
}
