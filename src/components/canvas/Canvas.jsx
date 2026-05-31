import React, { useRef, useState, useCallback, useMemo } from 'react';
import { NodeShell } from './NodeShell';
import { portAnchor } from './layout';
import { NODE_DEFS } from '../../engine/nodeDefs';

function cablePath(x1, y1, x2, y2) {
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function Canvas({ graph }) {
  const ref = useRef(null);
  const [pan, setPan] = useState({ x: 80, y: 40 });
  const [scale, setScale] = useState(1);
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(null); // {node, side, port, mouse:{x,y}}
  const pendingRef = useRef(null);
  const panState = useRef(null);

  const toWorld = useCallback((clientX, clientY) => {
    const rect = ref.current.getBoundingClientRect();
    return { x: (clientX - rect.left - pan.x) / scale, y: (clientY - rect.top - pan.y) / scale };
  }, [pan, scale]);

  const onBgPointerDown = useCallback((e) => {
    setSelected(null);
    panState.current = { startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
    const move = (ev) => {
      if (!panState.current) return;
      setPan({ x: panState.current.origX + (ev.clientX - panState.current.startX), y: panState.current.origY + (ev.clientY - panState.current.startY) });
    };
    const up = () => { panState.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [pan]);

  const onWheel = useCallback((e) => {
    // Only zoom with the modifier held; otherwise let the wheel pass through so
    // scrollable lists inside nodes (radio stations, presets) scroll normally.
    if (!(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0012;
    setScale((s) => Math.max(0.4, Math.min(1.6, s + delta)));
  }, []);

  // ── Connections ──
  const onPortDown = useCallback((node, side, port, e) => {
    if (side === 'in' && port.kind === 'mod') {
      // mod inputs take a single cable: clicking a filled one disconnects it
      const existing = graph.connections.find((c) => c.to.node === node.id && c.to.port === port.id);
      if (existing) { graph.removeConnection(existing.id); return; }
    }
    // audio inputs may be fanned-in: start a new cable (remove individual
    // audio cables by clicking the cable itself).
    const w = toWorld(e.clientX, e.clientY);
    const p = { node, side, port, mouse: w };
    pendingRef.current = p;
    setPending(p);
    const move = (ev) => { const wm = toWorld(ev.clientX, ev.clientY); if (pendingRef.current) pendingRef.current = { ...pendingRef.current, mouse: wm }; setPending((pp) => pp ? { ...pp, mouse: wm } : null); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); pendingRef.current = null; setTimeout(() => setPending(null), 0); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [graph, toWorld]);

  const onPortUp = useCallback((node, side, port) => {
    const p = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    if (!p || p.node.id === node.id) return;
    let from, to;
    if (p.side === 'out' && side === 'in') { from = { node: p.node.id, port: p.port.id, kind: p.port.kind }; to = { node: node.id, port: port.id, kind: port.kind }; }
    else if (p.side === 'in' && side === 'out') { from = { node: node.id, port: port.id, kind: port.kind }; to = { node: p.node.id, port: p.port.id, kind: p.port.kind }; }
    else return;
    if (from.kind === to.kind) graph.addConnection(from, to);
  }, [graph]);

  const nodeMap = useMemo(() => Object.fromEntries(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const filledPorts = useMemo(() => {
    const s = new Set();
    graph.connections.forEach((c) => { s.add(`${c.from.node}:out:${c.from.port}`); s.add(`${c.to.node}:in:${c.to.port}`); });
    return s;
  }, [graph.connections]);

  const cables = useMemo(() => {
    return graph.connections.map((c) => {
      const fn = nodeMap[c.from.node], tn = nodeMap[c.to.node];
      if (!fn || !tn) return null;
      const fdef = NODE_DEFS[fn.type], tdef = NODE_DEFS[tn.type];
      const oi = fdef.outputs.findIndex((o) => o.id === c.from.port);
      const ii = tdef.inputs.findIndex((i) => i.id === c.to.port);
      const a1 = portAnchor(fn, fdef, 'out', oi);
      const a2 = portAnchor(tn, tdef, 'in', ii);
      return { id: c.id, d: cablePath(a1.x, a1.y, a2.x, a2.y), color: fdef.accent, kind: c.from.kind };
    }).filter(Boolean);
  }, [graph.connections, nodeMap]);

  const pendingPath = useMemo(() => {
    if (!pending) return null;
    const def = NODE_DEFS[pending.node.type];
    const idx = pending.side === 'out' ? def.outputs.findIndex((o) => o.id === pending.port.id) : def.inputs.findIndex((i) => i.id === pending.port.id);
    const a = portAnchor(pending.node, def, pending.side, idx);
    const d = pending.side === 'out' ? cablePath(a.x, a.y, pending.mouse.x, pending.mouse.y) : cablePath(pending.mouse.x, pending.mouse.y, a.x, a.y);
    return { d, color: def.accent };
  }, [pending]);

  return (
    <div
      ref={ref}
      onPointerDown={onBgPointerDown}
      onWheel={onWheel}
      className="absolute inset-0 overflow-hidden"
      style={{
        cursor: panState.current ? 'grabbing' : 'default',
        backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: `${22 * scale}px ${22 * scale}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
        {/* Cables */}
        <svg style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none', width: 1, height: 1, left: 0, top: 0 }}>
          {cables.map((c) => (
            <g key={c.id} style={{ pointerEvents: 'stroke' }}>
              <path d={c.d} fill="none" stroke="transparent" strokeWidth="12" style={{ cursor: 'pointer' }} onClick={() => graph.removeConnection(c.id)} />
              <path d={c.d} fill="none" stroke={c.color} strokeWidth={c.kind === 'mod' ? 1.3 : 2} strokeOpacity={0.7} className={c.kind === 'mod' ? 'cable-flow' : ''} strokeLinecap="round" />
            </g>
          ))}
          {pendingPath && <path d={pendingPath.d} fill="none" stroke={pendingPath.color} strokeWidth="2" strokeOpacity={0.5} strokeDasharray="3 4" />}
        </svg>

        {/* Nodes */}
        {graph.nodes.map((node) => (
          <NodeShell
            key={node.id}
            node={node}
            def={NODE_DEFS[node.type]}
            scale={scale}
            selected={selected === node.id}
            onMove={graph.moveNode}
            onSelect={setSelected}
            onRemove={graph.removeNode}
            onToggleEnabled={graph.setNodeEnabled}
            updateParam={graph.updateParam}
            handle={graph.getHandle(node.id)}
            onPortDown={onPortDown}
            onPortUp={onPortUp}
            filledPorts={filledPorts}
          />
        ))}
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-3 left-3 text-[9px] text-white/20 uppercase tracking-widest no-select">
        {Math.round(scale * 100)}% · ⌘/Ctrl + scroll to zoom · drag bg to pan
      </div>
    </div>
  );
}
