import React from 'react';
import { VoiceShape } from './VoiceShape';
import { VOICE_TYPES } from '../engine/audioEngine';

export function VoicePicker({ onAdd }) {
  return (
    <div>
      <div className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Add Voice</div>
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(VOICE_TYPES).map(([key, def]) => (
          <button
            key={key}
            onClick={() => onAdd(key)}
            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/5 hover:border-white/15 hover:bg-white/3 transition-all group"
          >
            <VoiceShape
              type={def.shape}
              size={40}
              color={def.color}
              active={false}
              pulse={false}
            />
            <span className="text-[9px] text-white/30 group-hover:text-white/60 uppercase tracking-widest">
              {def.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
