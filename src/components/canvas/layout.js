export const HEADER_H = 32;
export const PORT_TOP = 44;
export const PORT_GAP = 19;

export function portAnchor(node, def, side, index, width) {
  const w = width || def.width;
  const x = side === 'in' ? node.x : node.x + w;
  const y = node.y + PORT_TOP + index * PORT_GAP;
  return { x, y };
}
