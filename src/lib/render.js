export const FONTS = {
  helvetica: { label: 'Sans (Helvetica)', css: 'Helvetica, Arial, sans-serif' },
  times: { label: 'Serif (Times)', css: '"Times New Roman", Times, serif' },
  courier: { label: 'Mono (Courier)', css: '"Courier New", Courier, monospace' },
};

// Shared text geometry for the canvas preview and the PDF so both match.
// Field coordinates are fractions of the ticket; size is % of ticket height.
// Returns the baseline-left point of the text, offset from the anchor.
export function textOffset(field, fontSize, textWidth) {
  const dx = field.align === 'left' ? 0 : field.align === 'right' ? -textWidth : -textWidth / 2;
  const dy = fontSize * 0.35; // roughly centers digits/capitals vertically on the anchor
  const a = (field.rotation * Math.PI) / 180;
  return {
    x: dx * Math.cos(a) + dy * Math.sin(a),
    y: -dx * Math.sin(a) + dy * Math.cos(a),
  };
}

export function drawField(ctx, field, text, x, y, w, h) {
  const size = (field.size / 100) * h;
  ctx.save();
  ctx.font = `${field.bold ? 'bold ' : ''}${size}px ${FONTS[field.font].css}`;
  ctx.fillStyle = field.color;
  ctx.textBaseline = 'alphabetic';
  const width = ctx.measureText(text).width;
  const o = textOffset(field, size, width);
  ctx.translate(x + field.x * w + o.x, y + field.y * h + o.y);
  ctx.rotate((-field.rotation * Math.PI) / 180);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// `texts` holds one string per field, in the same order as `fields`.
export function drawTicket(ctx, img, fields, texts, x, y, w, h) {
  ctx.drawImage(img, x, y, w, h);
  fields.forEach((f, k) => drawField(ctx, f, texts[k] ?? '', x, y, w, h));
}
