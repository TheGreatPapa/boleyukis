// Paper sizes in millimetres (portrait).
export const PAPERS = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
  Tabloid: [279.4, 431.8],
  Custom: null,
};

export function getPageSize(layout, orientation = layout.orientation) {
  const [w, h] = PAPERS[layout.paper] ?? [Number(layout.customW) || 210, Number(layout.customH) || 297];
  const short = Math.min(w, h);
  const long = Math.max(w, h);
  return orientation === 'landscape' ? [long, short] : [short, long];
}

export function computeLayout({ pageW, pageH, margin, gap, ticketW, ticketH, count }) {
  const m = Math.max(0, Number(margin) || 0);
  const g = Math.max(0, Number(gap) || 0);
  const eps = 1e-6;
  const fits = (avail, size) =>
    size > 0 ? Math.max(0, Math.floor((avail + g + eps) / (size + g))) : 0;

  const cols = fits(pageW - 2 * m, ticketW);
  const rows = fits(pageH - 2 * m, ticketH);
  const perPage = cols * rows;
  const pages = perPage ? Math.ceil(count / perPage) : 0;

  // Center the grid on the page.
  const gridW = cols * ticketW + Math.max(0, cols - 1) * g;
  const gridH = rows * ticketH + Math.max(0, rows - 1) * g;
  const offsetX = (pageW - gridW) / 2;
  const offsetY = (pageH - gridH) / 2;

  const slot = (i) => {
    const local = i % perPage;
    const c = local % cols;
    const r = Math.floor(local / cols);
    return {
      page: Math.floor(i / perPage),
      x: offsetX + c * (ticketW + g),
      y: offsetY + r * (ticketH + g),
    };
  };

  return { cols, rows, perPage, pages, slot, pageW, pageH, ticketW, ticketH, margin: m };
}

// Ticket width that fills the printable width with `cols` columns.
export function widthForColumns({ pageW, margin, gap, cols }) {
  const n = Math.max(1, Math.floor(cols));
  return (pageW - 2 * margin - (n - 1) * gap) / n;
}
