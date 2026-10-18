import { useEffect, useId, useRef, useState } from 'react';
import { useApp } from '../lib/context.js';
import { PARTIAL_OPTIONS, THREAD_TYPES, displayName, fmtSkeins, lightness, threadBackground } from '../lib/utils.js';

const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  plus: 'M12 5v14M5 12h14',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10',
  folder: 'M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6z',
  cart: 'M3 4h2l2.4 11h10.2L20 7H6M9 20a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z',
  data: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  x: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  warn: 'M12 3l10 18H2L12 3zM12 10v5M12 18v.5',
  check: 'M5 12l5 5 9-10',
};

export function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Swatch({ hex, colors, size = 28, w }) {
  return <span className="swatch" style={{ background: threadBackground({ hex, colors }), width: w || size, height: size }} aria-hidden="true" />;
}

// Always shows the catalog's current details for a color (name, gradient, ...), falling back to what is stored.
export function ColorCell({ color, sub }) {
  const { catalog } = useApp();
  const c = (color.brand && catalog.find(color.brand, color.code)) || color;
  const name = displayName(c);
  return (
    <div className="colorcell">
      <Swatch hex={c.hex} colors={c.colors} />
      <div className="names">
        <span><span className="code">{c.code}</span>{c.brand && c.brand !== 'DMC' ? <span className="muted"> · {c.brand}</span> : null}{c.pending ? <span className="pill warn" style={{ marginLeft: 6 }}>Needs details</span> : null}</span>
        <span className="muted small">{name}{c.type && c.type !== 'solid' ? `${name ? ' · ' : ''}${c.type}` : ''}{sub ? ` · ${sub}` : ''}</span>
      </div>
    </div>
  );
}

const MAX_STOPS = 5;

// One color picker for most threads; two to five for variegated skeins.
export function ColorsField({ type, colors, onChange }) {
  const multi = type === 'variegated';
  const list = multi ? (colors.length >= 2 ? colors : [colors[0] || '#808080', '#B0B0B0']) : [colors[0] || '#808080'];
  const set = (i, v) => onChange(list.map((c, j) => (j === i ? v.toUpperCase() : c)));
  return (
    <div className="stack tight">
      <div className="row tight">
        {list.map((c, i) => (
          <span className="row tight" key={i}>
            <input type="color" aria-label={`Color ${i + 1}`} value={c} onChange={(e) => set(i, e.target.value)} style={{ width: 44, height: 40, padding: 2, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)' }} />
            {multi && list.length > 2 && <button type="button" className="icon-btn" aria-label={`Remove color ${i + 1}`} onClick={() => onChange(list.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>}
          </span>
        ))}
        {multi && list.length < MAX_STOPS && <button type="button" className="chip" onClick={() => onChange([...list, list[list.length - 1]])}>+ Add color</button>}
      </div>
      {multi && <div style={{ height: 14, borderRadius: 7, background: threadBackground({ hex: list[0], colors: list }), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.16)' }} />}
    </div>
  );
}

export function TypeSelect({ value, onChange, id }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {THREAD_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

// Cross-stitch "X" on aida tile, used for the thread wall.
export function StitchX({ hex, colors }) {
  const dark = lightness(hex) > 0.8;
  const multi = colors?.length > 1;
  const gid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {multi && (
        <defs>
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="4" y1="4" x2="20" y2="20">
            {colors.map((c, i) => <stop key={i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c} />)}
          </linearGradient>
        </defs>
      )}
      <path d="M5 5l14 14M19 5L5 19" stroke={dark ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.18)'} strokeWidth="6.5" strokeLinecap="round" />
      <path d="M5 5l14 14M19 5L5 19" stroke={multi ? `url(#${gid})` : hex} strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, small, label }) {
  const [draft, setDraft] = useState(null);
  const fmt = (v) => (step < 1 ? String(Math.round(v * 100) / 100) : String(v));
  const commit = (raw) => {
    const n = parseFloat(raw);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n / step) * step)));
    setDraft(null);
  };
  return (
    <span className={'stepper' + (small ? ' sm' : '')} role="group" aria-label={label}>
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <input
        inputMode="decimal"
        aria-label={label}
        value={draft ?? fmt(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => draft !== null && commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
      />
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </span>
  );
}

export function PartialEditor({ partials, onChange }) {
  return (
    <div className="stack tight">
      <div className="row tight">
        {partials.length === 0 && <span className="muted small">No partial skeins</span>}
        {partials.map((p, i) => (
          <span className="partial-chip" key={i}>
            {fmtSkeins(p)}
            <button type="button" aria-label={`Remove ${fmtSkeins(p)} skein`} onClick={() => onChange(partials.filter((_, j) => j !== i))}>×</button>
          </span>
        ))}
      </div>
      <div className="row tight">
        <span className="muted small">Add partial:</span>
        {PARTIAL_OPTIONS.map((p) => (
          <button type="button" key={p} className="chip" onClick={() => onChange([...partials, p].sort())}>+ {fmtSkeins(p)}</button>
        ))}
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, head, full }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.open && d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={'sheet' + (full ? ' full' : '')}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="sheet-head">
        <div className="grow">{head || <h2>{title}</h2>}</div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      <div className={'sheet-body' + (full ? ' flush' : '')}>{children}</div>
      {footer && <div className="sheet-foot">{footer}</div>}
    </dialog>
  );
}

export function Confirm({ title, body, confirmLabel = 'Confirm', danger, onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className={'btn ' + (danger ? 'danger' : 'primary')} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </>}
    >
      <p>{body}</p>
    </Modal>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p style={{ maxWidth: 420 }}>{children}</p>}
      {action}
    </div>
  );
}
