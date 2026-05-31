import React, { useEffect, useRef } from 'react';
import { NODE_DEFS } from '../../engine/nodeDefs';

const SOURCE_CATS = new Set(['source', 'sequence', 'stream', 'looper']);

const MUTE_COLOR = '#d97a6a';  // warm/red
const SOLO_COLOR = '#8fbaa9';  // sage

function VU({ engine, nodeId, accent, tall }) {
  const ref = useRef(null);
  const raf = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tick = () => {
      raf.current = requestAnimationFrame(tick);
      let db = engine.getNodeLevel?.(nodeId);
      if (db === undefined || db === -Infinity) db = -60;
      const norm = Math.max(0, Math.min(1, (db + 60) / 60));
      el.style.width = `${norm * 100}%`;
    };
    tick();
    return () => cancelAnimationFrame(raf.current);
  }, [engine, nodeId]);
  return (
    <div className={`${tall ? 'h-1' : 'h-0.5'} rounded-full overflow-hidden`} style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div ref={ref} className="h-full rounded-full" style={{ background: accent, width: '0%', transition: 'width 0.05s linear' }} />
    </div>
  );
}

const fDb = (lvl) => (lvl > 0.0001 ? `${(20 * Math.log10(lvl)).toFixed(1)} dB` : '-∞ dB');
const panLabel = (v) => {
  const p = v ?? 0;
  if (Math.abs(p) < 0.02) return 'C';
  return p < 0 ? `L${Math.round(-p * 100)}` : `R${Math.round(p * 100)}`;
};

// Short musical descriptor for a source (key/chord, waveform, etc.).
function infoFor(n) {
  const p = n.params;
  switch (n.type) {
    case 'oscillator': return `${p.root} ${p.chord} · ${p.wave}`;
    case 'drift':
    case 'grain': return `${p.root} ${p.chord}`;
    case 'noise': return `${p.color} noise`;
    case 'noteCycler': return `seq · ${p.wave} · ${p.division}`;
    case 'progression': return `${(p.steps || []).length} chords · ${p.wave}`;
    case 'stream': return p.stationName || 'no station';
    case 'looper': return 'loop recorder';
    default: return NODE_DEFS[n.type]?.label || n.type;
  }
}

function PowerDot({ accent, enabled, onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={enabled ? 'Mute (power off)' : 'Power on'}
      className="w-3 h-3 rounded-full flex-shrink-0 transition-all"
      style={{ border: `1.5px solid ${enabled ? accent : 'rgba(255,255,255,0.2)'}`, background: enabled ? accent : 'transparent', boxShadow: enabled ? `0 0 5px ${accent}aa` : 'none' }}
    />
  );
}

function MSButtons({ muted, soloed, onMute, onSolo }) {
  const base = 'w-5 h-5 rounded text-[9px] font-cal flex items-center justify-center transition-all';
  return (
    <div className="flex gap-1 flex-shrink-0">
      <button onClick={(e) => { e.stopPropagation(); onMute(); }} title="Mute" className={base}
        style={{ color: muted ? MUTE_COLOR : 'rgba(255,255,255,0.4)', background: muted ? `${MUTE_COLOR}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${muted ? `${MUTE_COLOR}66` : 'transparent'}` }}>M</button>
      <button onClick={(e) => { e.stopPropagation(); onSolo(); }} title="Solo" className={base}
        style={{ color: soloed ? SOLO_COLOR : 'rgba(255,255,255,0.4)', background: soloed ? `${SOLO_COLOR}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${soloed ? `${SOLO_COLOR}66` : 'transparent'}` }}>S</button>
    </div>
  );
}

export function Mixer({ nodes, updateParam, engine, setNodeEnabled, setMute, setSolo, expanded, onToggleExpand, collapsed, onToggleCollapse }) {
  const channels = nodes.filter((n) => SOURCE_CATS.has(NODE_DEFS[n.type]?.category));
  const panelStyle = { background: 'rgba(16,16,19,0.85)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' };

  if (collapsed) {
    return (
      <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={panelStyle}>
        <div className="text-[9px] text-white/35 uppercase tracking-[0.18em] flex-1">Mixer</div>
        <span className="text-[9px] text-white/25">{channels.length}</span>
        <button onClick={onToggleCollapse} title="Expand" className="text-[9px] text-white/30 hover:text-white/70 leading-none" style={{ fontSize: 12 }}>⌄</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-3" style={panelStyle}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[9px] text-white/35 uppercase tracking-[0.18em]">Mixer</div>
        <div className="flex items-center gap-2.5">
          <button onClick={onToggleExpand} title={expanded ? 'Compact view' : 'Detailed view'}
            className="text-[9px] text-white/30 hover:text-white/70 uppercase tracking-widest flex items-center gap-1">
            {expanded ? 'compact' : 'detail'}
            <span style={{ fontSize: 11, lineHeight: 1 }}>{expanded ? '⤡' : '⤢'}</span>
          </button>
          <button onClick={onToggleCollapse} title="Collapse" className="text-white/30 hover:text-white/70 leading-none" style={{ fontSize: 12 }}>⌃</button>
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="text-[10px] text-white/20 py-3 text-center">No sources yet</div>
      ) : (
        <div className={`${expanded ? 'space-y-2 max-h-[60vh]' : 'space-y-2.5 max-h-[40vh]'} overflow-y-auto pr-1`}>
          {channels.map((n) => {
            const def = NODE_DEFS[n.type];
            const a = def.accent;
            const enabled = n.params.enabled !== false;
            const muted = !!n.params.muted;
            const soloed = !!n.params.soloed;
            const level = n.params.level ?? 0;

            if (!expanded) {
              return (
                <div key={n.id} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <PowerDot accent={a} enabled={enabled} onClick={() => setNodeEnabled(n.id, !enabled)} />
                    <span className="text-[10px] text-white/65 truncate flex-1" style={{ opacity: enabled && !muted ? 1 : 0.5 }}>{def.label}</span>
                    <MSButtons muted={muted} soloed={soloed} onMute={() => setMute(n.id, !muted)} onSolo={() => setSolo(n.id, !soloed)} />
                    <span className="text-[9px] text-white/30 w-6 text-right">{Math.round(level * 100)}</span>
                  </div>
                  <VU engine={engine} nodeId={n.id} accent={a} />
                  <input type="range" min={0} max={1} step={0.01} value={level}
                    onChange={(e) => updateParam(n.id, 'level', parseFloat(e.target.value))}
                    className="w-full" style={{ accentColor: a }} />
                  <div className="flex items-center gap-2">
                    <span className="text-[7px] text-white/25 uppercase tracking-wider">L</span>
                    <input type="range" min={-1} max={1} step={0.01} value={n.params.pan ?? 0}
                      onChange={(e) => updateParam(n.id, 'pan', parseFloat(e.target.value))}
                      className="flex-1" style={{ accentColor: a }} />
                    <span className="text-[7px] text-white/25 uppercase tracking-wider">R</span>
                  </div>
                </div>
              );
            }

            // ── Expanded channel card ──
            return (
              <div key={n.id} className="rounded-lg p-2.5 space-y-2" style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${(enabled && !muted) ? `${a}33` : 'rgba(255,255,255,0.05)'}` }}>
                <div className="flex items-center gap-1.5">
                  <PowerDot accent={a} enabled={enabled} onClick={() => setNodeEnabled(n.id, !enabled)} />
                  <div className="flex-1 min-w-0" style={{ opacity: enabled && !muted ? 1 : 0.5 }}>
                    <div className="font-cal text-[11px] text-white/85 truncate leading-none">{def.label}</div>
                    <div className="text-[8px] text-white/35 truncate mt-0.5">{infoFor(n)}</div>
                  </div>
                  <MSButtons muted={muted} soloed={soloed} onMute={() => setMute(n.id, !muted)} onSolo={() => setSolo(n.id, !soloed)} />
                </div>

                <VU engine={engine} nodeId={n.id} accent={a} tall />

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-white/35 uppercase tracking-[0.15em]">Level</span>
                    <span className="text-[9px] text-white/55 font-cal">{fDb(level)}</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.01} value={level}
                    onChange={(e) => updateParam(n.id, 'level', parseFloat(e.target.value))}
                    className="w-full" style={{ accentColor: a }} />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-white/35 uppercase tracking-[0.15em]">Pan</span>
                    <span className="text-[9px] text-white/55 font-cal">{panLabel(n.params.pan)}</span>
                  </div>
                  <input type="range" min={-1} max={1} step={0.01} value={n.params.pan ?? 0}
                    onChange={(e) => updateParam(n.id, 'pan', parseFloat(e.target.value))}
                    className="w-full" style={{ accentColor: a }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
