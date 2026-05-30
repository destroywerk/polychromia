import React, { useEffect, useRef } from 'react';

export function AmbientBackground({ voices }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const activeVoices = voices.filter(v => v.active);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      timeRef.current += 0.003;
      const t = timeRef.current;
      const W = canvas.width, H = canvas.height;

      ctx.fillStyle = 'rgba(10, 10, 11, 0.12)';
      ctx.fillRect(0, 0, W, H);

      if (activeVoices.length === 0) return;

      activeVoices.forEach((voice, i) => {
        const baseX = W * (0.2 + i * 0.15);
        const baseY = H * 0.5;
        const x = baseX + Math.sin(t * 0.7 + i * 1.3) * W * 0.06;
        const y = baseY + Math.cos(t * 0.5 + i * 2.1) * H * 0.08;

        const color = voice.color || '#b8d4c8';
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        const radius = 80 + Math.sin(t * 1.1 + i) * 20 + voice.volume * 40;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5);
        grad.addColorStop(0, `rgba(${r},${g},${b},0.08)`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},0.03)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

        ctx.beginPath();
        ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [voices]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
