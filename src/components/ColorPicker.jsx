import { useId, useMemo, useState } from 'react';
import { useApp } from '../lib/context.js';
import { displayName } from '../lib/utils.js';
import CatalogBrowser from './CatalogBrowser.jsx';
import ColorDetails from './ColorDetails.jsx';
import { Swatch } from './ui.jsx';

// Search-as-you-type picker. Type a code ("310"), a name ("lavender") or a family ("teal").
// If the code is not in the catalog you can create it on the spot (for example a variegated skein).
export default function ColorPicker({ onSelect, onMany, placeholder = 'Search by DMC number or name', autoFocus, hint, allowNew = true, browse = true }) {
  const { catalog } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(null);
  const [browsing, setBrowsing] = useState(false);
  const id = useId();
  const results = useMemo(() => catalog.search(q, 12), [catalog, q]);
  const trimmed = q.trim();
  const exact = results.some((c) => c.code.toLowerCase() === trimmed.toLowerCase());
  const showNew = allowNew && trimmed !== '' && !exact;
  const count = results.length + (showNew ? 1 : 0);

  const reset = () => { setQ(''); setOpen(false); setActive(0); };
  const pick = (c) => { onSelect(c); reset(); };
  const startNew = () => {
    setCreating({ code: /^[a-z]/i.test(trimmed) ? trimmed.toUpperCase() : trimmed });
    setOpen(false);
  };
  const choose = (i) => (i < results.length ? pick(results[i]) : startNew());

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(count - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && open && count > 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
      <div className="combo grow">
        <input
          className="input"
          role="combobox"
          aria-expanded={open && trimmed !== ''}
          aria-controls={id}
          aria-autocomplete="list"
          aria-label={placeholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
        />
        {open && trimmed !== '' && (
          <ul className="combo-list" id={id} role="listbox">
            {results.length === 0 && !showNew && <li className="combo-empty">No color matches “{q}”.</li>}
            {results.map((c, i) => (
              <li key={c.key} role="option" aria-selected={i === active} className="combo-opt" onMouseDown={(e) => { e.preventDefault(); pick(c); }} onMouseEnter={() => setActive(i)}>
                <Swatch hex={c.hex} colors={c.colors} />
                <div className="grow">
                  <b>{c.code}</b>{c.brand !== 'DMC' && <span className="muted"> · {c.brand}</span>} <span className="muted">{displayName(c)}</span>
                </div>
                {hint && <span className="muted small">{hint(c)}</span>}
              </li>
            ))}
            {showNew && (
              <li role="option" aria-selected={active === results.length} className="combo-opt" onMouseDown={(e) => { e.preventDefault(); startNew(); }} onMouseEnter={() => setActive(results.length)}>
                <span className="swatch" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 800 }}>+</span>
                <div className="grow"><b>Add “{trimmed}” as a new color</b><div className="muted small">Not in the catalog. Works for multicolor skeins too.</div></div>
              </li>
            )}
          </ul>
        )}
      </div>
      {browse && <button type="button" className="btn" onClick={() => setBrowsing(true)}>Browse</button>}
      {creating && <ColorDetails initial={creating} onClose={() => setCreating(null)} onSaved={(c) => pick(c)} />}
      {browsing && <CatalogBrowser onClose={() => setBrowsing(false)} onPick={(c) => { setBrowsing(false); onSelect(c); }} onMany={(list) => { setBrowsing(false); (onMany || ((l) => l.forEach(onSelect)))(list); }} />}
    </div>
  );
}
