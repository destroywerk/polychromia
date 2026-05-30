import React, { useState, useRef, useCallback } from 'react';
import { colorToAudioParams, getColorLabel, hexToHsl, PRESET_COLORS } from '../utils/colorToAudio';

function ColorWheel({ size = 200, onColorSelect }) {
  const canvasRef = useRef(null);
  const [mounted, useState_] = useState(false);

  const drawWheel = useCallback((canvas) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = size / 2, cy = size / 2, radius = size / 2 - 2;

    for (let angle = 0; angle < 360; angle++) {
      const startAngle = ((angle - 1) * Math.PI) / 180;
      const endAngle = ((angle + 1) * Math.PI) / 180;

      for (let r = 0; r <= radius; r++) {
        const saturation = r / radius;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = `hsl(${angle}, ${saturation * 100}%, 50%)`;
        ctx.fill();
      }
    }

    // Dark center overlay
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.15);
    gradient.addColorStop(0, 'rgba(10,10,11,0.9)');
    gradient.addColorStop(1, 'rgba(10,10,11,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [size]);

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel[3] === 0) return;
    const hex = `#${[pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('')}`;
    onColorSelect(hex);
  }, [onColorSelect]);

  return (
    <canvas
      ref={el => { canvasRef.current = el; drawWheel(el); }}
      width={size} height={size}
      onClick={handleClick}
      className="rounded-full cursor-crosshair"
      style={{ maxWidth: '100%' }}
    />
  );
}

function LightnessBar({ hex, onChange }) {
  const { h, s } = hexToHsl(hex);
  return (
    <div className="relative h-3 rounded-full cursor-pointer overflow-hidden"
      style={{ background: `linear-gradient(to right, hsl(${h},${s * 100}%,5%), hsl(${h},${s * 100}%,50%), hsl(${h},${s * 100}%,95%))` }}
      onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const l = (e.clientX - rect.left) / rect.width;
        const newH = h / 360;
        const r = Math.round((1 - l) * (0 + newH * 255));
        // simplified: just fire with l value for now via computed color
        const c = `hsl(${h},${s * 100}%,${l * 100}%)`;
        // convert to hex
        const tmp = document.createElement('div');
        tmp.style.color = c;
        document.body.appendChild(tmp);
        const computed = getComputedStyle(tmp).color;
        document.body.removeChild(tmp);
        const [rv, gv, bv] = computed.match(/\d+/g).map(Number);
        const newHex = `#${[rv, gv, bv].map(v => v.toString(16).padStart(2, '0')).join('')}`;
        onChange(newHex);
      }}
    />
  );
}

export function ColorMapper({ voices, onApplyColor }) {
  const [selectedColor, setSelectedColor] = useState('#b8d4c8');
  const [targetVoiceId, setTargetVoiceId] = useState('all');

  const params = colorToAudioParams(selectedColor);
  const label = getColorLabel(selectedColor);

  const applyColor = () => {
    const hsl = hexToHsl(selectedColor);
    if (targetVoiceId === 'all') {
      voices.forEach(v => onApplyColor(v.id, hsl, selectedColor));
    } else {
      onApplyColor(targetVoiceId, hsl, selectedColor);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <ColorWheel size={180} onColorSelect={setSelectedColor} />
      </div>

      {/* Selected color preview */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex-shrink-0"
          style={{ background: selectedColor, boxShadow: `0 0 16px ${selectedColor}66` }}
        />
        <div>
          <div className="font-cal text-sm text-white/80">{label}</div>
          <div className="text-[10px] text-white/30 font-mono">{selectedColor.toUpperCase()}</div>
        </div>
      </div>

      {/* Preset swatches */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map(({ hex, label }) => (
          <button
            key={hex}
            onClick={() => setSelectedColor(hex)}
            title={label}
            className="w-7 h-7 rounded-full transition-all hover:scale-110"
            style={{
              background: hex,
              boxShadow: selectedColor === hex ? `0 0 10px ${hex}99` : 'none',
              outline: selectedColor === hex ? `1.5px solid ${hex}` : 'none',
              outlineOffset: 2,
            }}
          />
        ))}
      </div>

      {/* Audio params preview */}
      <div className="bg-white/3 rounded-lg p-3 space-y-1.5">
        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Audio Influence</div>
        {[
          { label: 'Warmth', value: params.warmth },
          { label: 'Filter', value: params.filterFreq / 8200 },
          { label: 'Reverb', value: params.reverbWet },
          { label: 'Chorus', value: params.chorus },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="text-[10px] text-white/30 w-12">{label}</div>
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${value * 100}%`, background: selectedColor }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Target selector */}
      <div>
        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Apply To</div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTargetVoiceId('all')}
            className="text-[10px] px-2.5 py-1 rounded-full border transition-all uppercase tracking-widest"
            style={{
              borderColor: targetVoiceId === 'all' ? selectedColor : '#333',
              color: targetVoiceId === 'all' ? selectedColor : '#666',
            }}
          >
            All
          </button>
          {voices.map(v => (
            <button
              key={v.id}
              onClick={() => setTargetVoiceId(v.id)}
              className="text-[10px] px-2.5 py-1 rounded-full border transition-all uppercase tracking-widest"
              style={{
                borderColor: targetVoiceId === v.id ? selectedColor : '#333',
                color: targetVoiceId === v.id ? selectedColor : '#666',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={applyColor}
        className="w-full py-2.5 rounded-lg text-xs uppercase tracking-widest transition-all"
        style={{
          background: `${selectedColor}22`,
          border: `1px solid ${selectedColor}44`,
          color: selectedColor,
        }}
      >
        Apply Color
      </button>
    </div>
  );
}
