import React, { useRef, useCallback } from 'react';
import { NodeBody } from '../nodes/NodeBodies';
import { HEADER_H, PORT_TOP, PORT_GAP } from './layout';

function Port({ side, port, index, accent, filled, onPortDown, onPortUp, nodeId }) {
  const top = PORT_TOP + index * PORT_GAP;
  const isMod = port.kind === 'mod';
  return (
    <div
      className="absolute flex items-center gap-1 no-select"
      style={{ top: top - 6, [side === 'in' ? 'left' : 'right']: -7, flexDirection: side === 'in' ? 'row' : 'row-reverse' }}
    >
      <div
        data-port-node={nodeId} data-port-side={side} data-port-id={port.id}
        onPointerDown={(e) => { e.stopPropagation(); onPortDown(side, port, e); }}
        onPointerUp={(e) => { e.stopPropagation(); onPortUp(side, port, e); }}
        className="w-3 h-3 rounded-full cursor-crosshair transition-transform hover:scale-125"
        style={{
          background: filled ? accent : (isMod ? 'transparent' : '#16161b'),
          border: `1.5px solid ${accent}`,
          borderRadius: isMod ? '2px' : '50%',
          boxShadow: filled ? `0 0 6px ${accent}88` : 'none',
        }}
      />
      <span className="text-[7px] uppercase tracking-wider" style={{ color: `${accent}99` }}>{port.id}</span>
    </div>
  );
}

const SOURCE_CATS = new Set(['source', 'sequence', 'stream', 'looper']);

export function NodeShell({ node, def, scale, selected, onMove, onSelect, onRemove, onToggleEnabled, updateParam, handle, onPortDown, onPortUp, filledPorts }) {
  const dragRef = useRef(null);
  const isSource = SOURCE_CATS.has(def.category);
  const enabled = node.params.enabled !== false;

  const onHeaderDown = useCallback((e) => {
    e.stopPropagation();
    onSelect(node.id);
    const startX = e.clientX, startY = e.clientY;
    const origX = node.x, origY = node.y;
    const move = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      onMove(node.id, origX + dx, origY + dy);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [node.id, node.x, node.y, scale, onMove, onSelect]);

  const a = def.accent;

  return (
    <div
      ref={dragRef}
      className="absolute rounded-xl no-select"
      style={{
        left: node.x, top: node.y, width: def.width,
        background: 'linear-gradient(180deg, rgba(22,22,27,0.96), rgba(16,16,19,0.96))',
        border: `1px solid ${selected ? `${a}66` : 'rgba(255,255,255,0.07)'}`,
        boxShadow: selected ? `0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px ${a}22` : '0 6px 20px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
      }}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(node.id); }}
    >
      {/* Header */}
      <div
        onPointerDown={onHeaderDown}
        className="flex items-center justify-between px-3 cursor-grab active:cursor-grabbing"
        style={{ height: HEADER_H, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isSource ? (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onToggleEnabled(node.id, !enabled); }}
              title={enabled ? 'Mute this node' : 'Unmute this node'}
              className="w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
              style={{
                border: `1.5px solid ${enabled ? a : 'rgba(255,255,255,0.2)'}`,
                background: enabled ? a : 'transparent',
                boxShadow: enabled ? `0 0 6px ${a}aa` : 'none',
              }}
            />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a }} />
          )}
          <span className="font-cal text-[12px] truncate" style={{ color: isSource && !enabled ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)' }}>{def.label}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(node.id); }} className="text-white/25 hover:text-white/70 text-sm leading-none">×</button>
      </div>

      {/* Ports */}
      {def.inputs.map((port, i) => (
        <Port key={`in-${port.id}`} side="in" port={port} index={i} accent={a} nodeId={node.id}
          filled={filledPorts.has(`${node.id}:in:${port.id}`)}
          onPortDown={(side, p, e) => onPortDown(node, side, p, e)}
          onPortUp={(side, p, e) => onPortUp(node, side, p, e)} />
      ))}
      {def.outputs.map((port, i) => (
        <Port key={`out-${port.id}`} side="out" port={port} index={i} accent={a} nodeId={node.id}
          filled={filledPorts.has(`${node.id}:out:${port.id}`)}
          onPortDown={(side, p, e) => onPortDown(node, side, p, e)}
          onPortUp={(side, p, e) => onPortUp(node, side, p, e)} />
      ))}

      {/* Body */}
      <div className="px-3 py-3" style={{ paddingTop: Math.max(12, (Math.max(def.inputs.length, def.outputs.length)) * PORT_GAP - 8) }}>
        <NodeBody node={node} def={def} update={(k, v) => updateParam(node.id, k, v)} handle={handle} />
      </div>
    </div>
  );
}
