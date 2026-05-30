import React, { useEffect, useRef } from 'react';
import * as Tone from 'tone';

export function Visualizer({ voices, width = 600, height = 80 }) {
  const canvasRef = useRef(null);
  const analyzerRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (!analyzerRef.current) {
      try {
        analyzerRef.current = new Tone.Analyser('waveform', 256);
        Tone.getDestination().connect(analyzerRef.current);
      } catch (e) {
        return;
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const values = analyzerRef.current.getValue();
      const W = canvas.width, H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, 'rgba(10,10,11,0)');
      bg.addColorStop(0.5, 'rgba(10,10,11,0.3)');
      bg.addColorStop(1, 'rgba(10,10,11,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Waveform
      const activeVoice = voices.find(v => v.active);
      const lineColor = activeVoice?.color || '#b8d4c8';

      ctx.beginPath();
      ctx.strokeStyle = lineColor + '99';
      ctx.lineWidth = 1.5;

      const sliceWidth = W / values.length;
      let x = 0;
      for (let i = 0; i < values.length; i++) {
        const y = ((values[i] + 1) / 2) * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();

      // Center line
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff08';
      ctx.lineWidth = 0.5;
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
    };

    draw();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [voices]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full rounded-lg opacity-80"
      style={{ display: 'block' }}
    />
  );
}
