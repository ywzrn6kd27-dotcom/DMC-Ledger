import { useEffect, useRef, useState } from 'react';
import { PARTIAL_OPTIONS, fmtSkeins, lightness } from '../lib/utils.js';

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

export function Swatch({ hex, size = 28, w }) {
  return <span className="swatch" style={{ background: hex, width: w || size, height: size }} aria-hidden="true" />;
}

export function ColorCell({ color, sub }) {
  return (
    <div className="colorcell">
      <Swatch hex={color.hex} />
      <div className="names">
        <span><span className="code">{color.code}</span>{color.brand && color.brand !== 'DMC' ? <span className="muted"> · {color.brand}</span> : null}</span>
        <span className="muted small">{color.name}{sub ? ` · ${sub}` : ''}</span>
      </div>
    </div>
  );
}

// Cross-stitch "X" on aida tile, used for the thread wall.
export function StitchX({ hex }) {
  const dark = lightness(hex) > 0.8;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5l14 14M19 5L5 19" stroke={dark ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.18)'} strokeWidth="6.5" strokeLinecap="round" />
      <path d="M5 5l14 14M19 5L5 19" stroke={hex} strokeWidth="4.5" strokeLinecap="round" />
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

export function Modal({ title, onClose, children, footer, head }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.open && d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="sheet-head">
        <div className="grow">{head || <h2>{title}</h2>}</div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      <div className="sheet-body">{children}</div>
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
