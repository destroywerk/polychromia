import React, { useRef, useCallback } from 'react';

export function Knob({ value, min = 0, max = 1, step = 0.01, onChange, label, size = 38, accent = '#8fbaa9', format }) {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const onPointerDown = useCallback((e) => {
    e.stopPropagation();
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    const onMove = (ev) => {
      if (!dragging.current) return;
      const dy = startY.current - ev.clientY;
      const range = max - min;
      let next = startVal.current + (dy / 140) * range;
      next = Math.max(min, Math.min(max, Math.round(next / step) * step));
      onChange(parseFloat(next.toFixed(4)));
    };
    const onUp = () => { dragging.current = false; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [value, min, max, step, onChange]);

  const pct = (value - min) / (max - min);
  const angle = -135 + pct * 270;
  const r = size / 2 - 3;
  const cx = size / 2, cy = size / 2;
  const startA = (-135 - 90) * Math.PI / 180;
  const endA = (angle - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(startA), y1 = cy + r * Math.sin(startA);
  const x2 = cx + r * Math.cos(endA), y2 = cy + r * Math.sin(endA);
  const large = (angle - (-135)) > 180 ? 1 : 0;
  const ix = cx + (r - 1) * Math.cos(endA), iy = cy + (r - 1) * Math.sin(endA);

  return (
    <div className="flex flex-col items-center gap-1 no-select">
      <svg width={size} height={size} onPointerDown={onPointerDown} style={{ cursor: 'ns-resize' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#26262e" strokeWidth="2.5" />
        <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={ix} y2={iy} stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {label && <span className="text-[8px] text-white/35 uppercase tracking-[0.15em]">{label}</span>}
      {format && <span className="text-[9px] text-white/55 -mt-0.5">{format(value)}</span>}
    </div>
  );
}

export function Segmented({ options, value, onChange, accent = '#8fbaa9' }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const l = typeof opt === 'string' ? opt : opt.label;
        const active = v === value;
        return (
          <button
            key={v}
            onClick={(e) => { e.stopPropagation(); onChange(v); }}
            className="px-2 py-1 rounded text-[9px] uppercase tracking-[0.12em] transition-all"
            style={{
              background: active ? `${accent}22` : 'rgba(255,255,255,0.03)',
              color: active ? accent : 'rgba(255,255,255,0.4)',
              border: `1px solid ${active ? `${accent}55` : 'transparent'}`,
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function MiniSlider({ value, min = 0, max = 1, step = 0.01, onChange, label, accent = '#8fbaa9', format }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[8px] text-white/35 uppercase tracking-[0.12em] w-12 flex-shrink-0">{label}</span>}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-1"
        style={{ accentColor: accent }}
      />
      {format && <span className="text-[9px] text-white/45 w-8 text-right">{format(value)}</span>}
    </div>
  );
}

export function Stepper({ value, onChange, options, accent = '#8fbaa9', wide }) {
  const idx = options.indexOf(value);
  const go = (dir) => { const ni = (idx + dir + options.length) % options.length; onChange(options[ni]); };
  return (
    <div className="flex items-center justify-between rounded bg-white/3 border border-white/5" style={{ minWidth: wide ? 80 : 56 }}>
      <button onClick={(e) => { e.stopPropagation(); go(-1); }} className="px-1.5 py-0.5 text-white/30 hover:text-white/70 text-xs">‹</button>
      <span className="text-[10px] text-white/70 font-cal" style={{ color: accent }}>{value}</span>
      <button onClick={(e) => { e.stopPropagation(); go(1); }} className="px-1.5 py-0.5 text-white/30 hover:text-white/70 text-xs">›</button>
    </div>
  );
}
