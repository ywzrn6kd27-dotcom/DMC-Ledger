import { useId, useMemo, useState } from 'react';
import { Swatch } from './ui.jsx';

// Search-as-you-type picker. Type a code ("310"), a name ("lavender") or a family ("teal").
export default function ColorPicker({ catalog, onSelect, placeholder = 'Search by DMC number or name', autoFocus, hint }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const results = useMemo(() => catalog.search(q, 12), [catalog, q]);

  const pick = (c) => {
    onSelect(c);
    setQ('');
    setOpen(false);
    setActive(0);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && open && results[active]) { e.preventDefault(); pick(results[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="combo">
      <input
        className="input"
        role="combobox"
        aria-expanded={open && q.trim() !== ''}
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
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKey}
      />
      {open && q.trim() !== '' && (
        <ul className="combo-list" id={id} role="listbox">
          {results.length === 0 && (
            <li className="combo-empty">No color matches “{q}”. You can add it under Data → Custom colors.</li>
          )}
          {results.map((c, i) => (
            <li
              key={c.key}
              role="option"
              aria-selected={i === active}
              className="combo-opt"
              onMouseDown={(e) => { e.preventDefault(); pick(c); }}
              onMouseEnter={() => setActive(i)}
            >
              <Swatch hex={c.hex} />
              <div className="grow">
                <b>{c.code}</b>{c.brand !== 'DMC' && <span className="muted"> · {c.brand}</span>} <span className="muted">{c.name}</span>
              </div>
              {hint && <span className="muted small">{hint(c)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
