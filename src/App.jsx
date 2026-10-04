import { useMemo, useState } from 'react';
import TicketEditor from './components/TicketEditor';
import PagePreview from './components/PagePreview';
import { generateTickets, MAX_TICKETS } from './lib/sequence';
import { PAPERS, computeLayout, getPageSize, widthForColumns } from './lib/layout';
import { FONTS } from './lib/render';
import { loadTemplateFromFile, makeSampleTemplate } from './lib/image';
import { buildPdf } from './lib/pdf';
import { useTheme } from './lib/theme';

let nextId = 1;
const newSeq = (overrides = {}) => ({
  type: 'numbers',
  start: '1',
  count: '10',
  step: '1',
  padding: '0',
  prefix: '',
  suffix: '',
  lowercase: false,
  source: null,
  ...overrides,
});
const newField = (overrides = {}) => ({
  id: nextId++,
  x: 0.5,
  y: 0.5,
  size: 12,
  color: '#000000',
  font: 'helvetica',
  bold: true,
  align: 'center',
  rotation: 0,
  seq: newSeq(),
  ...overrides,
});

const num = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [template, setTemplate] = useState(null);
  const [error, setError] = useState('');
  const [fields, setFields] = useState(() => [newField({ seq: newSeq({ count: '50', padding: '3' }) })]);
  const [selectedId, setSelectedId] = useState(fields[0].id);
  const [lay, setLay] = useState({
    paper: 'A4',
    customW: '210',
    customH: '297',
    orientation: 'portrait',
    margin: '10',
    gap: '2',
    ticketW: '90',
    cutLines: true,
  });
  const [fitCols, setFitCols] = useState('2');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);

  const selected = fields.find((f) => f.id === selectedId) ?? fields[0];
  const updateField = (patch) =>
    setFields((fs) => fs.map((f) => (f.id === selected.id ? { ...f, ...patch } : f)));
  const seq = selected.seq;
  const updateSeq = (patch) => updateField({ seq: { ...seq, ...patch } });
  const setSeqKey = (k) => (e) =>
    updateSeq({ [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const positionName = (id) => `Position ${fields.findIndex((f) => f.id === id) + 1}`;
  // A position can mirror another counter, but not one that is itself a mirror
  // (or one that others already mirror), so there are no chains.
  const isMirrored = fields.some((f) => f.seq.type === 'copy' && f.seq.source === selected.id);
  const copySources = isMirrored
    ? []
    : fields.filter((f) => f.id !== selected.id && f.seq.type !== 'copy');
  const setLayKey = (k) => (e) =>
    setLay((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const { tickets: texts, combos, counters, lists } = useMemo(() => generateTickets(fields), [fields]);
  const previewTexts = texts[0] ?? fields.map(() => '001');
  const ticketLabel = (t) => t.join(' / ');

  const aspect = template ? template.height / template.width : 0.375;
  const ticketW = Math.max(1, num(lay.ticketW, 90));
  const ticketH = ticketW * aspect;
  const margin = Math.max(0, num(lay.margin));
  const gap = Math.max(0, num(lay.gap));

  const layoutFor = (orientation) => {
    const [pageW, pageH] = getPageSize(lay, orientation);
    return computeLayout({ pageW, pageH, margin, gap, ticketW, ticketH, count: texts.length });
  };
  const layout = useMemo(
    () => layoutFor(lay.orientation),
    [lay, ticketW, ticketH, margin, gap, texts.length],
  );
  const otherOrientation = lay.orientation === 'portrait' ? 'landscape' : 'portrait';
  const otherLayout = layoutFor(otherOrientation);
  const safePage = Math.min(page, Math.max(0, layout.pages - 1));

  async function handleFile(file) {
    if (!file) return;
    setError('');
    try {
      setTemplate(await loadTemplateFromFile(file));
    } catch (e) {
      setError(e.message);
    }
  }

  async function useSample() {
    setTemplate(await makeSampleTemplate());
    const main = newField({
      x: 0.115, y: 0.79, size: 13, color: '#ffffff', align: 'left',
      seq: newSeq({ count: '50', padding: '3' }),
    });
    const stub = newField({
      x: 0.875, y: 0.55, size: 16, color: '#1e3a8a',
      seq: newSeq({ type: 'copy', source: main.id }),
    });
    setFields([main, stub]);
    setSelectedId(main.id);
  }

  function addField() {
    const f = { ...selected, id: nextId++, y: Math.min(0.95, selected.y + 0.15), seq: newSeq() };
    setFields((fs) => [...fs, f]);
    setSelectedId(f.id);
  }

  function removeField() {
    if (fields.length <= 1) return;
    // Positions that mirrored the removed one become independent counters.
    const rest = fields
      .filter((f) => f.id !== selected.id)
      .map((f) =>
        f.seq.type === 'copy' && f.seq.source === selected.id
          ? { ...f, seq: { ...f.seq, type: 'numbers', source: null } }
          : f,
      );
    setFields(rest);
    setSelectedId(rest[0].id);
  }

  function applyFitColumns() {
    const w = widthForColumns({ pageW: layout.pageW, margin, gap, cols: num(fitCols, 1) });
    if (w > 0) setLay((s) => ({ ...s, ticketW: String(Math.floor(w * 10) / 10) }));
  }

  const positionTabs = (
    <div className="tabs">
      {fields.map((f, i) => (
        <button
          key={f.id}
          className={f.id === selected.id ? 'tab active' : 'tab'}
          onClick={() => setSelectedId(f.id)}
        >
          Position {i + 1}
          {f.seq.type === 'copy' && ` = ${positionName(f.seq.source)}`}
        </button>
      ))}
      <button className="tab add" onClick={addField} title="Add another number position">
        + Add
      </button>
    </div>
  );

  async function downloadPdf() {
    setBusy(true);
    // Let the button repaint before the synchronous PDF work.
    await new Promise((r) => setTimeout(r, 30));
    try {
      const doc = buildPdf({ template, fields, texts, layout, cutLines: lay.cutLines });
      const name = (t) => t.filter(Boolean).join('-').replace(/[^\w-]+/g, '');
      doc.save(`tickets-${name(texts[0])}_${name(texts[texts.length - 1])}.pdf`);
    } catch (e) {
      setError(`PDF failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header>
        <div>
          <h1>Ticket Numberer</h1>
          <p>Upload a ticket design, place the numbers, choose the paper and download a print-ready PDF.</p>
        </div>
        <button
          className="btn small theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </header>

      {!template ? (
        <section className="card upload">
          <label
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files[0]);
            }}
          >
            <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files[0])} />
            <strong>Drop a ticket image here</strong>
            <span>or click to choose a file (PNG, JPG, WEBP…)</span>
          </label>
          <button className="link" onClick={useSample}>
            or try it with a sample ticket
          </button>
          {error && <p className="error">{error}</p>}
        </section>
      ) : (
        <main className="grid">
          <div className="col">
            <section className="card">
              <div className="card-head">
                <h2>1. Ticket & number position</h2>
                <label className="btn small">
                  Change image
                  <input type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files[0])} />
                </label>
              </div>
              <p className="hint">Click or drag on the ticket to place the selected number.</p>
              <TicketEditor
                template={template}
                fields={fields}
                selectedId={selected.id}
                previewTexts={previewTexts}
                onPlace={updateField}
              />

              {positionTabs}

              <div className="form">
                <label>
                  Size (% of height)
                  <input type="number" min="1" max="100" step="0.5" value={selected.size}
                    onChange={(e) => updateField({ size: num(e.target.value, 1) })} />
                </label>
                <label>
                  Color
                  <input type="color" value={selected.color} onChange={(e) => updateField({ color: e.target.value })} />
                </label>
                <label>
                  Font
                  <select value={selected.font} onChange={(e) => updateField({ font: e.target.value })}>
                    {Object.entries(FONTS).map(([k, f]) => (
                      <option key={k} value={k}>{f.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Align
                  <select value={selected.align} onChange={(e) => updateField({ align: e.target.value })}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label>
                  Rotation
                  <select value={selected.rotation} onChange={(e) => updateField({ rotation: num(e.target.value) })}>
                    <option value="0">0°</option>
                    <option value="90">90° (reads upward)</option>
                    <option value="180">180°</option>
                    <option value="270">270° (reads downward)</option>
                  </select>
                </label>
                <label className="check">
                  <input type="checkbox" checked={selected.bold} onChange={(e) => updateField({ bold: e.target.checked })} />
                  Bold
                </label>
              </div>
              {fields.length > 1 && (
                <button className="link danger" onClick={removeField}>Remove this position</button>
              )}
            </section>

            <section className="card">
              <h2>2. Sequence — {positionName(selected.id)}</h2>
              <p className="hint">
                Each position has its own sequence. The last position changes first; when it runs out,
                the previous one advances (like an odometer).
              </p>
              {positionTabs}
              <div className="form">
                <label>
                  Type
                  <select
                    value={seq.type === 'copy' ? `copy:${seq.source}` : seq.type}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.startsWith('copy:')) updateSeq({ type: 'copy', source: Number(v.slice(5)) });
                      else updateSeq({ type: v, source: null });
                    }}
                  >
                    <option value="numbers">Numbers (1, 2, 3…)</option>
                    <option value="letters">Letters (A, B … Z, AA…)</option>
                    {copySources.map((f) => (
                      <option key={f.id} value={`copy:${f.id}`}>Same as {positionName(f.id)}</option>
                    ))}
                  </select>
                </label>
                {seq.type !== 'copy' && (
                  <>
                    <label>
                      Start at
                      <input value={seq.start} onChange={setSeqKey('start')} placeholder={seq.type === 'letters' ? 'A' : '1'} />
                    </label>
                    <label>
                      Quantity
                      <input type="number" min="1" max={MAX_TICKETS} value={seq.count} onChange={setSeqKey('count')} />
                    </label>
                    <label>
                      Step
                      <input type="number" min="1" value={seq.step} onChange={setSeqKey('step')} />
                    </label>
                    {seq.type === 'numbers' ? (
                      <label>
                        Digits (zero padding)
                        <input type="number" min="0" max="12" value={seq.padding} onChange={setSeqKey('padding')} />
                      </label>
                    ) : (
                      <label className="check">
                        <input type="checkbox" checked={seq.lowercase} onChange={setSeqKey('lowercase')} />
                        Lowercase
                      </label>
                    )}
                  </>
                )}
                <label>
                  Prefix
                  <input value={seq.prefix} onChange={setSeqKey('prefix')} placeholder="e.g. Nº " />
                </label>
                <label>
                  Suffix
                  <input value={seq.suffix} onChange={setSeqKey('suffix')} />
                </label>
              </div>
              <div className="stats">
                <span>
                  {counters.map((f, k) => `${positionName(f.id)} (${lists[k].length})`).join(' × ')}
                  {counters.length > 1 && ` = ${combos}`}
                  {' '}<b>{texts.length} tickets</b>
                </span>
              </div>
              <p className="hint">
                {texts.length
                  ? `${texts.slice(0, 3).map(ticketLabel).join(', ')}${texts.length > 3 ? ` … ${ticketLabel(texts[texts.length - 1])}` : ''}`
                  : 'No tickets — check the start values and quantities.'}
              </p>
              {combos > MAX_TICKETS && (
                <p className="error">
                  That makes {combos} combinations; only the first {MAX_TICKETS} are used. Reduce a quantity.
                </p>
              )}
            </section>
          </div>

          <div className="col">
            <section className="card">
              <h2>3. Paper & layout</h2>
              <div className="form">
                <label>
                  Paper
                  <select value={lay.paper} onChange={setLayKey('paper')}>
                    {Object.keys(PAPERS).map((p) => (
                      <option key={p} value={p}>
                        {p}{PAPERS[p] ? ` (${PAPERS[p][0]} × ${PAPERS[p][1]} mm)` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Orientation
                  <select value={lay.orientation} onChange={setLayKey('orientation')}>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>
                {lay.paper === 'Custom' && (
                  <>
                    <label>
                      Width (mm)
                      <input type="number" min="10" value={lay.customW} onChange={setLayKey('customW')} />
                    </label>
                    <label>
                      Height (mm)
                      <input type="number" min="10" value={lay.customH} onChange={setLayKey('customH')} />
                    </label>
                  </>
                )}
                <label>
                  Margin (mm)
                  <input type="number" min="0" step="0.5" value={lay.margin} onChange={setLayKey('margin')} />
                </label>
                <label>
                  Gap between tickets (mm)
                  <input type="number" min="0" step="0.5" value={lay.gap} onChange={setLayKey('gap')} />
                </label>
                <label>
                  Ticket width (mm)
                  <input type="number" min="1" step="0.5" value={lay.ticketW} onChange={setLayKey('ticketW')} />
                </label>
                <label>
                  Ticket height (mm)
                  <input type="number" min="1" step="0.5" value={Math.round(ticketH * 10) / 10}
                    onChange={(e) => {
                      const h = num(e.target.value);
                      if (h > 0) setLay((s) => ({ ...s, ticketW: String(Math.round((h / aspect) * 10) / 10) }));
                    }} />
                </label>
                <label className="inline">
                  Fit
                  <input type="number" min="1" value={fitCols} onChange={(e) => setFitCols(e.target.value)} />
                  columns
                  <button className="btn small" onClick={applyFitColumns}>Apply</button>
                </label>
                <label className="check">
                  <input type="checkbox" checked={lay.cutLines} onChange={setLayKey('cutLines')} />
                  Draw cut lines
                </label>
              </div>

              <div className="stats">
                {layout.perPage ? (
                  <>
                    <span><b>{layout.cols} × {layout.rows}</b> = {layout.perPage} per page</span>
                    <span><b>{layout.pages}</b> page{layout.pages === 1 ? '' : 's'} for {texts.length} tickets</span>
                  </>
                ) : (
                  <span className="error">The ticket doesn't fit on this paper. Make it smaller or reduce the margin.</span>
                )}
              </div>
              {otherLayout.perPage > layout.perPage && (
                <p className="hint">
                  {otherOrientation[0].toUpperCase() + otherOrientation.slice(1)} would fit {otherLayout.perPage} per page.{' '}
                  <button className="link" onClick={() => setLay((s) => ({ ...s, orientation: otherOrientation }))}>
                    Switch
                  </button>
                </p>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <h2>4. Preview</h2>
                {layout.pages > 1 && (
                  <div className="pager">
                    <button className="btn small" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>‹</button>
                    <span>Page {safePage + 1} / {layout.pages}</span>
                    <button className="btn small" disabled={safePage >= layout.pages - 1} onClick={() => setPage(safePage + 1)}>›</button>
                  </div>
                )}
              </div>
              <PagePreview template={template} fields={fields} texts={texts} layout={layout} page={safePage} cutLines={lay.cutLines} />
              <button className="btn primary block" disabled={!layout.perPage || !texts.length || busy} onClick={downloadPdf}>
                {busy ? 'Generating…' : `Download PDF (${layout.pages} page${layout.pages === 1 ? '' : 's'})`}
              </button>
              {error && <p className="error">{error}</p>}
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
