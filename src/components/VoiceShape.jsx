import React from 'react';

const SHAPES = {
  circle: ({ size, color, active, pulse }) => (
    <circle
      cx={size / 2} cy={size / 2} r={size * 0.38}
      fill={active ? color : 'none'}
      stroke={color}
      strokeWidth={active ? 1 : 1.5}
      opacity={active ? 0.9 : 0.5}
    >
      {pulse && active && (
        <animate attributeName="r" values={`${size * 0.38};${size * 0.44};${size * 0.38}`} dur="3s" repeatCount="indefinite" />
      )}
    </circle>
  ),

  triangle: ({ size, color, active }) => {
    const cx = size / 2, h = size * 0.75;
    const pts = [
      `${cx},${(size - h) / 2}`,
      `${cx - h * 0.577},${(size + h) / 2}`,
      `${cx + h * 0.577},${(size + h) / 2}`,
    ].join(' ');
    return (
      <polygon points={pts} fill={active ? color : 'none'} stroke={color}
        strokeWidth={active ? 1 : 1.5} opacity={active ? 0.9 : 0.5} />
    );
  },

  square: ({ size, color, active }) => (
    <rect x={size * 0.15} y={size * 0.15} width={size * 0.7} height={size * 0.7}
      fill={active ? color : 'none'} stroke={color}
      strokeWidth={active ? 1 : 1.5} opacity={active ? 0.9 : 0.5} />
  ),

  diamond: ({ size, color, active }) => {
    const cx = size / 2, cy = size / 2;
    const pts = `${cx},${cy - size * 0.4} ${cx + size * 0.35},${cy} ${cx},${cy + size * 0.4} ${cx - size * 0.35},${cy}`;
    return (
      <polygon points={pts} fill={active ? color : 'none'} stroke={color}
        strokeWidth={active ? 1 : 1.5} opacity={active ? 0.9 : 0.5} />
    );
  },

  hexagon: ({ size, color, active }) => {
    const cx = size / 2, cy = size / 2, r = size * 0.38;
    const pts = Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 180) * (60 * i - 30);
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');
    return (
      <polygon points={pts} fill={active ? color : 'none'} stroke={color}
        strokeWidth={active ? 1 : 1.5} opacity={active ? 0.9 : 0.5} />
    );
  },

  pentagon: ({ size, color, active }) => {
    const cx = size / 2, cy = size / 2, r = size * 0.38;
    const pts = Array.from({ length: 5 }, (_, i) => {
      const angle = (Math.PI / 180) * (72 * i - 90);
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');
    return (
      <polygon points={pts} fill={active ? color : 'none'} stroke={color}
        strokeWidth={active ? 1 : 1.5} opacity={active ? 0.9 : 0.5} />
    );
  },

  star: ({ size, color, active, pulse }) => {
    const cx = size / 2, cy = size / 2;
    const outer = size * 0.4, inner = size * 0.18;
    const pts = Array.from({ length: 10 }, (_, i) => {
      const angle = (Math.PI / 180) * (36 * i - 90);
      const r = i % 2 === 0 ? outer : inner;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');
    return (
      <polygon points={pts} fill={active ? color : 'none'} stroke={color}
        strokeWidth={active ? 1 : 1.5} opacity={active ? 0.9 : 0.5}>
        {pulse && active && (
          <animateTransform attributeName="transform" type="rotate"
            values={`0 ${cx} ${cy};360 ${cx} ${cy}`} dur="8s" repeatCount="indefinite" />
        )}
      </polygon>
    );
  },

  blob: ({ size, color, active }) => {
    const c = size / 2, r = size * 0.35;
    const d = `M ${c} ${c - r}
      C ${c + r * 0.8} ${c - r * 0.8}, ${c + r * 1.1} ${c + r * 0.2}, ${c + r * 0.6} ${c + r * 0.8}
      C ${c + r * 0.2} ${c + r * 1.1}, ${c - r * 0.6} ${c + r * 0.9}, ${c - r * 0.9} ${c + r * 0.3}
      C ${c - r * 1.1} ${c - r * 0.3}, ${c - r * 0.7} ${c - r * 0.9}, ${c} ${c - r} Z`;
    return (
      <path d={d} fill={active ? color : 'none'} stroke={color}
        strokeWidth={active ? 1 : 1.5} opacity={active ? 0.9 : 0.5} />
    );
  },
};

export function VoiceShape({ type = 'circle', size = 64, color = '#b8d4c8', active = false, pulse = true, onClick }) {
  const ShapeFn = SHAPES[type] || SHAPES.circle;

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', filter: active ? `drop-shadow(0 0 8px ${color}66)` : 'none' }}
    >
      <ShapeFn size={size} color={color} active={active} pulse={pulse} />
    </svg>
  );
}

export default VoiceShape;
