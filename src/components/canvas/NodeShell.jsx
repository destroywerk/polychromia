import React, { useRef, useCallback, useLayoutEffect } from 'react';
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
      <span className="text-[12px] capitalize" style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.3)' }}>{port.id}</span>
    </div>
  );
}

const SOURCE_CATS = new Set(['source', 'sequence', 'stream', 'looper']);

export function NodeShell({ node, def, scale, selected, onMove, onSelect, onRemove, onToggleEnabled, updateParam, handle, onPortDown, onPortUp, filledPorts, width, onWidth }) {
  const dragRef = useRef(null);
  const bodyRef = useRef(null);
  const isSource = SOURCE_CATS.has(def.category);
  const enabled = node.params.enabled !== false;
  const boxWidth = width || def.width;

  // Auto-grow the node so its contents never overflow: measure the body's
  // natural (scroll) width and, if it exceeds the current box, report the
  // larger width up so both the box and the cable anchors use it.
  useLayoutEffect(() => {
    if (!bodyRef.current || !onWidth) return;
    const needed = Math.max(def.width, Math.ceil(bodyRef.current.scrollWidth));
    if (needed !== boxWidth) onWidth(node.id, needed);
  });

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
      className="absolute rounded-lg no-select"
      style={{
        left: node.x, top: node.y, width: boxWidth,
        background: 'rgba(25,28,32,0.9)',
        border: `0.5px solid ${selected ? a : 'rgba(255,255,255,0.3)'}`,
        boxShadow: selected ? `0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px ${a}33` : '0 6px 20px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
      }}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(node.id); }}
    >
      {/* Header */}
      <div
        onPointerDown={onHeaderDown}
        className="flex items-center justify-between px-3 cursor-grab active:cursor-grabbing"
        style={{ height: HEADER_H, borderBottom: '0.5px solid rgba(255,255,255,0.2)' }}
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
          <span className="font-cal text-[14px] truncate" style={{ color: isSource && !enabled ? 'rgba(255,255,255,0.35)' : '#ffffff' }}>{def.label}</span>
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
      <div ref={bodyRef} className="px-3 py-3" style={{ paddingTop: Math.max(16, (PORT_TOP - HEADER_H) + Math.max(0, Math.max(def.inputs.length, def.outputs.length) - 1) * PORT_GAP + 16) }}>
        <NodeBody node={node} def={def} update={(k, v) => updateParam(node.id, k, v)} handle={handle} />
      </div>
    </div>
  );
}
