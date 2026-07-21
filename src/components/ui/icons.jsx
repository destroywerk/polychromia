import React from 'react';
import chevronUp from '../../assets/chevron-up.svg';
import chevronDown from '../../assets/chevron-down.svg';

// Plain hamburger icon (no button surround) — just an icon that brightens on
// hover. Used to toggle the left palette.
export function HamburgerButton({ onClick, title, className = '', style }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`text-white/50 hover:text-white transition-colors flex items-center justify-center leading-none ${className}`}
      style={style}
    >
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="3" width="10" height="1" rx="0.5" fill="currentColor" />
        <rect x="2" y="6.5" width="10" height="1" rx="0.5" fill="currentColor" />
        <rect x="2" y="10" width="10" height="1" rx="0.5" fill="currentColor" />
      </svg>
    </button>
  );
}

// Expand / contract chevron used by the right-hand panels. `collapsed` picks the
// down arrow (expand) vs up arrow (contract).
export function CollapseButton({ collapsed, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title || (collapsed ? 'Expand' : 'Collapse')}
      className="opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center"
    >
      <img src={collapsed ? chevronDown : chevronUp} alt="" aria-hidden="true" width="12" height="12" />
    </button>
  );
}
