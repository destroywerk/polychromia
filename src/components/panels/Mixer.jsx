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

const TRACK_BG = '#2c2c34';
// Volume fill: accent from the left up to the value.
const fillBg = (pct, accent) =>
  `linear-gradient(to right, ${accent} 0%, ${accent} ${pct}%, ${TRACK_BG} ${pct}%, ${TRACK_BG} 100%) center / 100% 4px no-repeat`;
// Pan fill: accent segment between centre (50%) and the thumb.
const panBg = (pan, accent) => {
  const v = ((Math.max(-1, Math.min(1, pan ?? 0)) + 1) / 2) * 100;
  const lo = Math.min(50, v), hi = Math.max(50, v);
  return `linear-gradient(to right, ${TRACK_BG} 0%, ${TRACK_BG} ${lo}%, ${accent} ${lo}%, ${accent} ${hi}%, ${TRACK_BG} ${hi}%, ${TRACK_BG} 100%) center / 100% 4px no-repeat`;
};

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
      className="w-3 h-3 rounded-full flex-shrink-0 transition-all hover:scale-125"
      style={{ border: `1.5px solid ${enabled ? accent : 'rgba(255,255,255,0.2)'}`, background: enabled ? accent : 'transparent', boxShadow: enabled ? `0 0 5px ${accent}aa` : 'none' }}
    />
  );
}

function MSButtons({ muted, soloed, onMute, onSolo }) {
  const base = 'w-5 h-5 rounded-md text-[9px] font-cal flex items-center justify-center';
  return (
    <div className="flex gap-1 flex-shrink-0">
      <button onClick={(e) => { e.stopPropagation(); onMute(); }} title="Mute"
        className={`${base} ${muted ? '' : 'ctl ctl-acc'}`}
        style={muted
          ? { color: MUTE_COLOR, background: `${MUTE_COLOR}22`, border: `0.5px solid ${MUTE_COLOR}` }
          : { color: 'rgba(255,255,255,0.55)', '--acc': MUTE_COLOR }}>M</button>
      <button onClick={(e) => { e.stopPropagation(); onSolo(); }} title="Solo"
        className={`${base} ${soloed ? '' : 'ctl ctl-acc'}`}
        style={soloed
          ? { color: SOLO_COLOR, background: `${SOLO_COLOR}22`, border: `0.5px solid ${SOLO_COLOR}` }
          : { color: 'rgba(255,255,255,0.55)', '--acc': SOLO_COLOR }}>S</button>
    </div>
  );
}

export function Mixer({ nodes, updateParam, engine, setNodeEnabled, setMute, setSolo, expanded, onToggleExpand, collapsed, onToggleCollapse }) {
  const channels = nodes.filter((n) => SOURCE_CATS.has(NODE_DEFS[n.type]?.category));
  const panelStyle = { background: 'rgba(25,28,32,0.6)', border: '0.5px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(12px)' };

  if (collapsed) {
    return (
      <div className="rounded-lg px-3 py-2.5 flex items-center gap-2" style={panelStyle}>
        <div className="ui-label text-[9px] flex-1">Mixer</div>
        <span className="ui-value text-[9px]">{channels.length}</span>
        <button onClick={onToggleCollapse} title="Expand" className="text-white/40 hover:text-white/80 leading-none" style={{ fontSize: 12 }}>⌄</button>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-3" style={panelStyle}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="ui-label text-[9px]">Mixer</div>
        <div className="flex items-center gap-2.5">
          <button onClick={onToggleExpand} title={expanded ? 'Compact view' : 'Detailed view'}
            className="ui-label text-[9px] hover:text-white flex items-center gap-1">
            {expanded ? 'Compact' : 'Detail'}
            <span style={{ fontSize: 11, lineHeight: 1 }}>{expanded ? '⤡' : '⤢'}</span>
          </button>
          <button onClick={onToggleCollapse} title="Collapse" className="text-white/40 hover:text-white/80 leading-none" style={{ fontSize: 12 }}>⌃</button>
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="ui-label text-[10px] py-3 text-center">No sources yet</div>
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
                    <span className="ui-value text-[10px] truncate flex-1" style={{ opacity: enabled && !muted ? 1 : 0.5 }}>{def.label}</span>
                    <MSButtons muted={muted} soloed={soloed} onMute={() => setMute(n.id, !muted)} onSolo={() => setSolo(n.id, !soloed)} />
                    <span className="ui-value text-[9px] w-6 text-right">{Math.round(level * 100)}</span>
                  </div>
                  <VU engine={engine} nodeId={n.id} accent={a} />
                  <input type="range" min={0} max={1} step={0.01} value={level}
                    onChange={(e) => updateParam(n.id, 'level', parseFloat(e.target.value))}
                    className="w-full mix-range" style={{ background: fillBg(level * 100, a) }} />
                  <div className="flex items-center gap-2">
                    <span className="ui-label text-[7px]">L</span>
                    <input type="range" min={-1} max={1} step={0.01} value={n.params.pan ?? 0}
                      onChange={(e) => updateParam(n.id, 'pan', parseFloat(e.target.value))}
                      className="flex-1 mix-range" style={{ background: panBg(n.params.pan, a) }} />
                    <span className="ui-label text-[7px]">R</span>
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
                    <div className="ui-value text-[11px] truncate leading-none">{def.label}</div>
                    <div className="ui-label text-[8px] truncate mt-0.5">{infoFor(n)}</div>
                  </div>
                  <MSButtons muted={muted} soloed={soloed} onMute={() => setMute(n.id, !muted)} onSolo={() => setSolo(n.id, !soloed)} />
                </div>

                <VU engine={engine} nodeId={n.id} accent={a} tall />

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="ui-label text-[9px]">Level</span>
                    <span className="ui-value text-[9px]">{fDb(level)}</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.01} value={level}
                    onChange={(e) => updateParam(n.id, 'level', parseFloat(e.target.value))}
                    className="w-full mix-range" style={{ background: fillBg(level * 100, a) }} />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="ui-label text-[9px]">Pan</span>
                    <span className="ui-value text-[9px]">{panLabel(n.params.pan)}</span>
                  </div>
                  <input type="range" min={-1} max={1} step={0.01} value={n.params.pan ?? 0}
                    onChange={(e) => updateParam(n.id, 'pan', parseFloat(e.target.value))}
                    className="w-full mix-range" style={{ background: panBg(n.params.pan, a) }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
