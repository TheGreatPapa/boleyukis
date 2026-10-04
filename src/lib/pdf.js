import { jsPDF } from 'jspdf';
import { textOffset } from './render';

const PT_PER_MM = 72 / 25.4;

export function buildPdf({ template, fields, texts, layout: L, cutLines }) {
  const orientation = L.pageW > L.pageH ? 'landscape' : 'portrait';
  const doc = new jsPDF({ unit: 'mm', format: [L.pageW, L.pageH], orientation, compress: true });

  texts.forEach((ticketTexts, i) => {
    const { x, y } = L.slot(i);
    if (i > 0 && i % L.perPage === 0) doc.addPage([L.pageW, L.pageH], orientation);

    // Same alias on every call -> the image is embedded only once.
    doc.addImage(template.src, template.format, x, y, L.ticketW, L.ticketH, 'ticket-bg', 'FAST');

    for (const [k, f] of fields.entries()) {
      const text = ticketTexts[k];
      if (!text) continue;
      const sizeMm = (f.size / 100) * L.ticketH;
      doc.setFont(f.font, f.bold ? 'bold' : 'normal');
      doc.setFontSize(sizeMm * PT_PER_MM);
      doc.setTextColor(f.color);
      const o = textOffset(f, sizeMm, doc.getTextWidth(text));
      doc.text(text, x + f.x * L.ticketW + o.x, y + f.y * L.ticketH + o.y, { angle: f.rotation });
    }

    if (cutLines) {
      doc.setDrawColor(170);
      doc.setLineWidth(0.1);
      doc.rect(x, y, L.ticketW, L.ticketH);
    }
  });

  return doc;
}
