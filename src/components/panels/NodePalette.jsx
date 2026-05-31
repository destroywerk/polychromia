import React, { useRef } from 'react';
import { NODE_DEFS, NODE_CATEGORIES } from '../../engine/nodeDefs';

const ICONS = {
  oscillator: '∿', drift: '◍', grain: '∷', noise: '▒',
  noteCycler: '↻', progression: '⊞', stream: '◈',
  looper: '⊚', lfo: '〜', filter: '⏚', delay: '⋯', reverb: '◌', eq: '▤', warp: '✦',
};

const IMPORT_ACCENT = '#8fbaa9'; // sage — matches the source palette

export function NodePalette({ onAdd, onImportImage, open }) {
  const fileRef = useRef(null);
  if (!open) return null;

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file && onImportImage) onImportImage(file);
    e.target.value = ''; // allow re-importing the same file
  };

  return (
    <div className="absolute left-3 top-3 bottom-3 w-52 rounded-xl p-3 overflow-y-auto z-20 no-select"
      style={{ background: 'rgba(16,16,19,0.9)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(14px)' }}>
      <div className="mb-3">
        <h2 className="font-cal text-base text-white/90">Polychromia</h2>
        <div className="text-[8px] text-white/30 uppercase tracking-[0.2em] mt-0.5">Modular Studio</div>
      </div>

      {/* Photo → Patch */}
      {onImportImage && (
        <div className="mb-4">
          <div className="text-[8px] text-white/30 uppercase tracking-[0.18em] mb-1.5">Photo → Patch</div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <button
            onClick={() => fileRef.current && fileRef.current.click()}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all group"
            style={{ background: `${IMPORT_ACCENT}0d`, border: `1px solid ${IMPORT_ACCENT}33` }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${IMPORT_ACCENT}66`; e.currentTarget.style.background = `${IMPORT_ACCENT}18`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${IMPORT_ACCENT}33`; e.currentTarget.style.background = `${IMPORT_ACCENT}0d`; }}
          >
            <span className="text-sm w-4 text-center" style={{ color: IMPORT_ACCENT }}>◳</span>
            <span className="font-cal text-[11px] text-white/75 group-hover:text-white/95">Import Image</span>
            <span className="ml-auto text-white/15 group-hover:text-white/40 text-xs">↑</span>
          </button>
          <div className="text-[8px] text-white/25 mt-1 leading-snug">Turns a photo's colours &amp; shapes into a drone of oscillators.</div>
        </div>
      )}

      {NODE_CATEGORIES.map((cat) => (
        <div key={cat.id} className="mb-4">
          <div className="text-[8px] text-white/30 uppercase tracking-[0.18em] mb-1.5">{cat.label}</div>
          <div className="space-y-1">
            {cat.types.map((type) => {
              const def = NODE_DEFS[type];
              return (
                <button
                  key={type}
                  onClick={() => onAdd(type)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all group"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${def.accent}44`; e.currentTarget.style.background = `${def.accent}0d`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                >
                  <span className="text-sm w-4 text-center" style={{ color: def.accent }}>{ICONS[type]}</span>
                  <span className="text-[11px] text-white/65 group-hover:text-white/90">{def.label}</span>
                  <span className="ml-auto text-white/15 group-hover:text-white/40 text-xs">+</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
