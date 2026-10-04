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

const norm = (s) => String(s ?? '').trim().toUpperCase();

// Matches a special cap's "when" value against a generated value:
// case-insensitive, and numerically for numbers ("2" matches "002").
export function sameValue(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x) return false;
  if (x === y) return true;
  return /^-?\d+$/.test(x) && /^-?\d+$/.test(y) && Number(x) === Number(y);
}

// Combines each position's sequence like an odometer: the last position changes
// fastest, earlier ones advance when it wraps. 'copy' positions mirror another
// position's value instead of adding a dimension. A position's special caps
// change its quantity depending on the previous counter's current value.
// Returns { tickets: string[][] (one text per field), combos, counters, lists }.
export function generateTickets(fields) {
  const counters = fields.filter((f) => f.seq.type !== 'copy');
  const lists = counters.map((f) => sequenceValues(f.seq));

  // Values for counter k while the previous counter shows `prev`.
  const cache = new Map();
  const valuesAt = (k, prev) => {
    const seq = counters[k].seq;
    const cap = k > 0 ? (seq.caps ?? []).find((c) => sameValue(c.when, prev)) : null;
    if (!cap) return lists[k];
    const key = `${k}|${cap.count}`;
    if (!cache.has(key)) cache.set(key, sequenceValues(seq, cap.count));
    return cache.get(key);
  };

  // Total combinations, counted without building them (memoized per value).
  const memo = counters.map(() => new Map());
  const countFrom = (k, prev) => {
    if (k === counters.length) return 1;
    const key = prev ?? '';
    if (!memo[k].has(key)) {
      let n = 0;
      for (const v of valuesAt(k, prev)) n += countFrom(k + 1, v);
      memo[k].set(key, n);
    }
    return memo[k].get(key);
  };
  const combos = counters.length ? countFrom(0, null) : 0;

  const tickets = [];
  const current = new Array(counters.length);
  const walk = (k) => {
    if (k === counters.length) {
      const text = new Map(counters.map((f, i) => [f.id, f.seq.prefix + current[i] + f.seq.suffix]));
      tickets.push(
        fields.map((f) =>
          f.seq.type === 'copy' ? f.seq.prefix + (text.get(f.seq.source) ?? '') + f.seq.suffix : text.get(f.id),
        ),
      );
      return;
    }
    for (const v of valuesAt(k, k ? current[k - 1] : null)) {
      if (tickets.length >= MAX_TICKETS) return;
      current[k] = v;
      walk(k + 1);
    }
  };
  if (counters.length) walk(0);

  return { tickets, combos, counters, lists };
}

export function generateSequence(seq) {
  return sequenceValues(seq).map((v) => seq.prefix + v + seq.suffix);
}

// The bare values (no prefix/suffix) of a sequence, optionally with another quantity.
export function sequenceValues({ type, start, count, step, padding, lowercase }, quantity = count) {
  const total = Math.max(0, Math.min(Math.floor(Number(quantity) || 0), MAX_TICKETS));
  const inc = Math.floor(Number(step)) || 1;
  const out = [];

  if (type === 'letters') {
    // Start accepts a letter ("C") or a position number ("3").
    const base = fromLetters(start) || parseInt(start, 10) || 1;
    for (let i = 0; i < total; i++) {
      const n = base + i * inc;
      if (n < 1) break;
      const s = toLetters(n);
      out.push(lowercase ? s.toLowerCase() : s);
    }
  } else {
    const base = parseInt(start, 10) || 0;
    const pad = Math.max(0, Math.min(Number(padding) || 0, 12));
    for (let i = 0; i < total; i++) {
      const n = base + i * inc;
      out.push((n < 0 ? '-' : '') + String(Math.abs(n)).padStart(pad, '0'));
    }
  }
  return out;
}
