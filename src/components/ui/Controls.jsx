import React, { useRef, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
      {label && <span className="ui-label text-[9px]">{label}</span>}
      {format && <span className="ui-value text-[9px] -mt-0.5">{format(value)}</span>}
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
            className={`ui-value px-2 py-1 text-[9px] ${active ? 'rounded-lg' : 'ctl ctl-acc'}`}
            style={active
              ? { background: `${accent}22`, color: accent, border: `0.5px solid ${accent}`, borderRadius: 8 }
              : { '--acc': accent, color: 'rgba(255,255,255,0.8)' }}
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
      {label && <span className="ui-label text-[9px] w-12 flex-shrink-0">{label}</span>}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-1"
        style={{ accentColor: accent }}
      />
      {format && <span className="ui-value text-[9px] w-8 text-right">{format(value)}</span>}
    </div>
  );
}

export function Stepper({ value, onChange, options, accent = '#8fbaa9', wide, height }) {
  const idx = options.indexOf(value);
  const go = (dir) => { const ni = (idx + dir + options.length) % options.length; onChange(options[ni]); };

  // Click the displayed value to open a quick-pick dropdown of all options.
  // Rendered through a portal in screen-space so it's never clipped by node
  // overflow and always stacks above other nodes. The ‹ › arrows still step.
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const valRef = useRef(null);
  const popRef = useRef(null);

  const toggle = (e) => {
    e.stopPropagation();
    const r = valRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ left: r.left + r.width / 2, top: r.bottom + 4 });
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const inside = (t) => (popRef.current && popRef.current.contains(t)) || (valRef.current && valRef.current.contains(t));
    const onDown = (ev) => { if (!inside(ev.target)) setOpen(false); };
    const onWheel = (ev) => { if (!inside(ev.target)) setOpen(false); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('wheel', onWheel, true);
    window.addEventListener('resize', () => setOpen(false));
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('wheel', onWheel, true);
    };
  }, [open]);

  return (
    <div className="ctl ctl-acc flex items-center justify-between" style={{ minWidth: wide ? 80 : 56, height, '--acc': accent }}>
      <button onClick={(e) => { e.stopPropagation(); go(-1); }} className="px-1.5 py-0.5 text-white/40 hover:text-white/90 text-xs">‹</button>
      <button ref={valRef} onPointerDown={(e) => e.stopPropagation()} onClick={toggle}
        title="Click to choose" className="ui-value text-[10px] px-1 leading-none cursor-pointer hover:opacity-80">{value}</button>
      <button onClick={(e) => { e.stopPropagation(); go(1); }} className="px-1.5 py-0.5 text-white/40 hover:text-white/90 text-xs">›</button>
      {open && pos && createPortal(
        <div ref={popRef} onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}
          className="fixed rounded-lg p-1 no-select"
          style={{
            left: pos.left, top: pos.top, transform: 'translateX(-50%)', zIndex: 9999,
            minWidth: wide ? 90 : 60, maxHeight: 200, overflowY: 'auto',
            background: 'rgba(16,16,19,0.97)', border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          }}>
          {options.map((opt) => {
            const active = opt === value;
            return (
              <button key={String(opt)} onClick={(e) => { e.stopPropagation(); onChange(opt); setOpen(false); }}
                className="block w-full text-left px-2 py-1 rounded text-[12px] font-cal transition-colors"
                style={{ color: active ? accent : 'rgba(255,255,255,0.8)', background: active ? `${accent}22` : 'transparent' }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                {opt}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
