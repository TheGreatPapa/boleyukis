import { useEffect, useRef } from 'react';
import { drawTicket } from '../lib/render';

const MAX_RES = 1400;
const clamp = (v) => Math.min(1, Math.max(0, v));

export default function TicketEditor({ template, fields, selectedId, previewTexts, onPlace }) {
  const canvasRef = useRef(null);
  const dragging = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    const scale = Math.min(1, MAX_RES / template.width);
    c.width = Math.round(template.width * scale);
    c.height = Math.round(template.height * scale);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    drawTicket(ctx, template.el, fields, previewTexts, 0, 0, c.width, c.height);

    // Anchor markers
    const r = Math.max(6, c.width / 90);
    for (const f of fields) {
      const x = f.x * c.width;
      const y = f.y * c.height;
      const active = f.id === selectedId;
      ctx.lineWidth = Math.max(1.5, c.width / 500);
      ctx.strokeStyle = active ? '#e11d48' : 'rgba(255,255,255,0.9)';
      ctx.fillStyle = active ? 'rgba(225,29,72,0.25)' : 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 1.8, y);
      ctx.lineTo(x + r * 1.8, y);
      ctx.moveTo(x, y - r * 1.8);
      ctx.lineTo(x, y + r * 1.8);
      ctx.stroke();
    }
  }, [template, fields, selectedId, previewTexts]);

  const place = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    onPlace({
      x: clamp((e.clientX - rect.left) / rect.width),
      y: clamp((e.clientY - rect.top) / rect.height),
    });
  };

  return (
    <canvas
      ref={canvasRef}
      className="ticket-canvas"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        place(e);
      }}
      onPointerMove={(e) => dragging.current && place(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    />
  );
}
