import React, { useRef } from 'react';
import { NODE_DEFS, NODE_CATEGORIES } from '../../engine/nodeDefs';

const ICONS = {
  oscillator: '∿', drift: '◍', grain: '∷', noise: '▒', sampler: '◼',
  noteCycler: '↻', synthSeq: '⎓', arp: '⇗', progression: '⊞', stream: '◈',
  looper: '⊚', lfo: '〜', filter: '⏚', delay: '⋯', reverb: '◌', eq: '▤', warp: '✦',
  stutter: '⊟', pixelate: '▦', timestretch: '⟿', freeze: '❄', harmonizer: '⋔',
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
    <div className="absolute left-0 top-0 bottom-0 w-[264px] pl-5 pr-3 py-4 overflow-y-auto z-20 no-select"
      style={{ background: 'rgba(25,28,32,0.6)', backdropFilter: 'blur(12px)' }}>
      <div className="mb-5">
        <h2 className="font-cal text-white leading-none" style={{ fontSize: 20 }}>Polychromia</h2>
      </div>

      {/* Photo → Patch */}
      {onImportImage && (
        <div className="mb-5">
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <button
            onClick={() => fileRef.current && fileRef.current.click()}
            className="pal-item w-full flex items-center h-[60px] pl-[18px] pr-3"
            style={{ '--acc': IMPORT_ACCENT }}
          >
            <span className="w-6 text-center text-2xl leading-none" style={{ color: IMPORT_ACCENT }}>◳</span>
            <span className="font-cal text-white ml-[18px]" style={{ fontSize: 14 }}>Import image</span>
            <span className="pal-plus ml-auto text-sm" style={{ color: IMPORT_ACCENT }}>↑</span>
          </button>
          <div className="ui-label mt-2 leading-snug">Turn an image's colour and shape into a lush drone of generators.</div>
        </div>
      )}

      {NODE_CATEGORIES.map((cat) => (
        <div key={cat.id} className="mb-5">
          <div className="ui-label text-[9px] mb-2">{cat.label}</div>
          <div className="space-y-2">
            {cat.types.map((type) => {
              const def = NODE_DEFS[type];
              return (
                <button
                  key={type}
                  onClick={() => onAdd(type)}
                  className="pal-item w-full flex items-center h-10 pl-3.5 pr-3"
                  style={{ '--acc': def.accent }}
                >
                  <span className="w-3 text-center text-sm leading-none" style={{ color: def.accent }}>{ICONS[type]}</span>
                  <span className="ui-value text-[11px] ml-3.5">{def.label}</span>
                  <span className="pal-plus ml-auto leading-none" style={{ color: '#ffffff', fontSize: 18 }}>+</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
