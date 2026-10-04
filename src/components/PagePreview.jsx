import { useEffect, useRef } from 'react';
import { drawTicket } from '../lib/render';

const PREVIEW_W = 520;

export default function PagePreview({ template, fields, texts, layout: L, page, cutLines }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const s = (PREVIEW_W / L.pageW) * dpr; // px per mm
    c.width = Math.round(L.pageW * s);
    c.height = Math.round(L.pageH * s);
    c.style.aspectRatio = `${L.pageW} / ${L.pageH}`;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);

    // Printable area
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = dpr;
    ctx.strokeRect(L.margin * s, L.margin * s, (L.pageW - 2 * L.margin) * s, (L.pageH - 2 * L.margin) * s);
    ctx.setLineDash([]);

    if (!L.perPage) return;
    const first = page * L.perPage;
    const last = Math.min(texts.length, first + L.perPage);
    for (let i = first; i < last; i++) {
      const { x, y } = L.slot(i);
      drawTicket(ctx, template.el, fields, texts[i], x * s, y * s, L.ticketW * s, L.ticketH * s);
      if (cutLines) {
        ctx.strokeStyle = '#999';
        ctx.lineWidth = Math.max(0.5, 0.1 * s);
        ctx.strokeRect(x * s, y * s, L.ticketW * s, L.ticketH * s);
      }
    }
  }, [template, fields, texts, L, page, cutLines]);

  return <canvas ref={canvasRef} className="page-canvas" />;
}
