import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/context.js';
import * as ops from '../lib/ops.js';
import { FAMILIES, displayName, fmtSkeins, lightness } from '../lib/utils.js';
import { Modal, Swatch } from './ui.jsx';

const ROW = 56;

function sectionLabel(code) {
  if (!/^\d+$/.test(code)) return '#';
  const n = parseInt(code, 10);
  return n < 100 ? '01' : `${Math.floor(n / 100)}xx`;
}

// Scrollable catalog of every color with filters, owned counts and multi-select.
export default function CatalogBrowser({ onClose, onPick, onMany }) {
  const { state, catalog } = useApp();
  const [q, setQ] = useState('');
  const [family, setFamily] = useState('');
  const [owned, setOwned] = useState('all');
  const [sort, setSort] = useState('number');
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const scroller = useRef(null);
  const [view, setView] = useState({ top: 0, h: 600 });

  const list = useMemo(() => {
    let l = q.trim() ? catalog.search(q, 2000) : [...catalog.list];
    if (family) l = l.filter((c) => c.family === family);
    l = l.filter((c) => {
      const it = state.inventory[c.key];
      const t = ops.totalOf(it);
      if (owned === 'owned') return t > 0;
      if (owned === 'none') return t === 0;
      if (owned === 'partial') return !!it?.partials.length;
      return true;
    });
    if (sort === 'color' && !q.trim())
      l.sort((a, b) => FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family) || lightness(a.hex) - lightness(b.hex));
    return l;
  }, [catalog, q, family, owned, sort, state.inventory]);

  const sections = useMemo(() => {
    if (sort !== 'number' || q.trim()) return [];
    const seen = new Map();
    list.forEach((c, i) => { const k = sectionLabel(c.code); if (!seen.has(k)) seen.set(k, i); });
    return [...seen.entries()];
  }, [list, sort, q]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setView({ top: el.scrollTop, h: el.clientHeight });
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => { el.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, []);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 0; }, [q, family, owned, sort]);

  const start = Math.max(0, Math.floor(view.top / ROW) - 6);
  const end = Math.min(list.length, Math.ceil((view.top + view.h) / ROW) + 6);
  const toggle = (c) => setPicked((s) => { const n = new Set(s); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n; });
  const click = (c) => (multi ? toggle(c) : onPick(c));

  return (
    <Modal
      full
      title="Browse colors"
      onClose={onClose}
      footer={multi ? (
        <>
          <span className="muted left">{picked.size} selected</span>
          <button className="btn primary" disabled={!picked.size} onClick={() => onMany(catalog.list.filter((c) => picked.has(c.key)))}>Add {picked.size || ''} selected</button>
        </>
      ) : null}
    >
      <div className="browser">
        <div className="browser-filters">
          <div className="row">
            <input className="input grow" type="search" placeholder="Filter by number or name" aria-label="Filter colors" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="chip" aria-pressed={multi} onClick={() => setMulti((m) => !m)}>Select several</button>
          </div>
          <div className="chips scroll-x">
            <button className="chip" aria-pressed={family === ''} onClick={() => setFamily('')}>All</button>
            {FAMILIES.map((f) => <button key={f} className="chip" aria-pressed={family === f} onClick={() => setFamily(family === f ? '' : f)}>{f}</button>)}
          </div>
          <div className="row tight">
            {[['all', 'All'], ['owned', 'Own'], ['none', "Don't own"], ['partial', 'Partial']].map(([k, l]) => (
              <button key={k} className="chip" aria-pressed={owned === k} onClick={() => setOwned(k)}>{l}</button>
            ))}
            <span className="grow" />
            <button className="chip" aria-pressed={sort === 'color'} onClick={() => setSort(sort === 'number' ? 'color' : 'number')}>{sort === 'number' ? 'Sort by color' : 'Sort by number'}</button>
          </div>
          <div className="muted small">{list.length} color{list.length === 1 ? '' : 's'}</div>
        </div>
        <div className="browser-body">
          <div className="browser-scroll" ref={scroller}>
            {list.length === 0 && <div className="empty">No colors match these filters.</div>}
            <div style={{ height: list.length * ROW, position: 'relative' }}>
              {list.slice(start, end).map((c, k) => {
                const i = start + k;
                const t = ops.totalOf(state.inventory[c.key]);
                const sel = picked.has(c.key);
                return (
                  <button key={c.key} className="browser-row" style={{ top: i * ROW, height: ROW }} onClick={() => click(c)} aria-pressed={multi ? sel : undefined}>
                    {multi && <span className={'check' + (sel ? ' on' : '')} aria-hidden="true">{sel ? '✓' : ''}</span>}
                    <Swatch hex={c.hex} colors={c.colors} size={32} />
                    <span className="grow" style={{ minWidth: 0 }}>
                      <b>{c.code}</b>{c.brand !== 'DMC' && <span className="muted"> · {c.brand}</span>}
                      <span className="muted small" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(c)}{c.type !== 'solid' ? ` · ${c.type}` : ''}</span>
                    </span>
                    {t > 0 ? <span className="pill ok">Own {fmtSkeins(t)}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
          {sections.length > 1 && (
            <div className="jumpbar" aria-label="Jump to section">
              {sections.map(([label, idx]) => (
                <button key={label} onClick={() => { scroller.current.scrollTop = idx * ROW; }} aria-label={`Jump to ${label}`}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
