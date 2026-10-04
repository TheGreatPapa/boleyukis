export const MAX_TICKETS = 5000;

// 1 -> A, 26 -> Z, 27 -> AA ...
export function toLetters(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function fromLetters(str) {
  let n = 0;
  for (const c of String(str).trim().toUpperCase()) {
    const v = c.charCodeAt(0) - 64;
    if (v < 1 || v > 26) return NaN;
    n = n * 26 + v;
  }
  return n || NaN;
}

// Combines each position's sequence like an odometer: the last position changes
// fastest, earlier ones advance when it wraps. 'copy' positions mirror another
// position's value instead of adding a dimension.
// Returns { tickets: string[][] (one text per field), combos }.
export function generateTickets(fields) {
  const counters = fields.filter((f) => f.seq.type !== 'copy');
  const lists = counters.map((f) => generateSequence(f.seq));
  const combos = lists.length ? lists.reduce((n, l) => n * l.length, 1) : 0;
  const total = Math.min(combos, MAX_TICKETS);

  const tickets = [];
  for (let i = 0; i < total; i++) {
    const values = new Map();
    let rest = i;
    for (let k = counters.length - 1; k >= 0; k--) {
      const list = lists[k];
      values.set(counters[k].id, list[rest % list.length]);
      rest = Math.floor(rest / list.length);
    }
    tickets.push(
      fields.map((f) =>
        f.seq.type === 'copy'
          ? f.seq.prefix + (values.get(f.seq.source) ?? '') + f.seq.suffix
          : values.get(f.id),
      ),
    );
  }
  return { tickets, combos, counters, lists };
}

export function generateSequence({ type, start, count, step, padding, prefix, suffix, lowercase }) {
  const total = Math.max(0, Math.min(Math.floor(Number(count) || 0), MAX_TICKETS));
  const inc = Math.floor(Number(step)) || 1;
  const out = [];

  if (type === 'letters') {
    const base = fromLetters(start) || 1;
    for (let i = 0; i < total; i++) {
      const n = base + i * inc;
      if (n < 1) break;
      let s = toLetters(n);
      if (lowercase) s = s.toLowerCase();
      out.push(prefix + s + suffix);
    }
  } else {
    const base = parseInt(start, 10) || 0;
    const pad = Math.max(0, Math.min(Number(padding) || 0, 12));
    for (let i = 0; i < total; i++) {
      const n = base + i * inc;
      const s = String(Math.abs(n)).padStart(pad, '0');
      out.push(prefix + (n < 0 ? '-' : '') + s + suffix);
    }
  }
  return out;
}
