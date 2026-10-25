import React from 'react';
import { BANDS } from './engine/scoring';

export const inr = (n: number): string => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
};
export const inrFull = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;
export const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const fmtDateTime = (ts: number): string =>
  new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) +
  ' ' + new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });

export const bandColor = (band: string): string =>
  BANDS.find((b) => b.name === band)?.color ?? '#5E7191';

export function ScoreBadge({ score, band, size = 'md' }: { score: number; band: string; size?: 'sm' | 'md' | 'lg' }) {
  const c = bandColor(band);
  const pad = size === 'lg' ? 'text-2xl px-3 py-1.5' : size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-0.5';
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`num font-semibold rounded-md border ${pad}`} style={{ color: c, borderColor: `${c}55`, background: `${c}12` }}>{score}</span>
      {size !== 'sm' && <span className="chip" style={{ color: c, background: `${c}14`, borderColor: `${c}30` }}>{band}</span>}
    </span>
  );
}

function useCountUp(target: number, enabled: boolean): number {
  const [v, setV] = React.useState(enabled ? 0 : target);
  React.useEffect(() => {
    if (!enabled || target <= 0) { setV(target); return; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const dur = 900;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return v;
}

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  const numeric = typeof value === 'number';
  const shown = useCountUp(numeric ? (value as number) : 0, numeric);
  return (
    <div className="card p-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-mute">{label}</div>
      <div className="mt-2.5 text-[28px] leading-8 font-semibold num" style={{ color: accent ?? 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>{numeric ? shown.toLocaleString('en-IN') : value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-ink-soft leading-snug">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{children}</h2>
      {right}
    </div>
  );
}

export function FactorBars({ factors }: { factors: { key: string; label: string; points: number; max: number; observed: string }[] }) {
  const sorted = [...factors].sort((a, b) => b.points - a.points);
  const maxPts = Math.max(1, ...sorted.map((f) => f.points));
  return (
    <div className="space-y-3">
      {sorted.map((f) => (
        <div key={f.key}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[13px] font-medium">{f.label}</div>
            <div className="num text-[12px] text-ink-soft whitespace-nowrap">{f.points.toFixed(1)} / {f.max}</div>
          </div>
          <div className="mt-1.5 h-[5px] rounded-full bg-[#141E30] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(f.points / maxPts) * 100}%`, background: 'var(--color-brand)', opacity: 0.35 + 0.65 * (f.points / f.max) }} />
          </div>
          <div className="mt-1 text-[12px] leading-snug text-ink-soft">{f.observed}</div>
        </div>
      ))}
      {sorted.length === 0 && <div className="text-sm text-ink-mute">No risk indicators fired for this account.</div>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-10 text-center">
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="mt-1 text-xs text-ink-mute">{hint}</div>}
    </div>
  );
}

/* ================================================================
   GLOSSARY & TOOLTIPS (Feature 1: Speed of Learning)
   ================================================================ */
export const GLOSSARY: Record<string, string> = {
  'mule score': 'Algorithmic suspicion score (0–100) combining pass-through velocity, graph centrality, dormancy surge, and complaint distance.',
  'score': 'Composite score indicating risk probability. Scores rank suspicion for review, not legal proof of guilt.',
  'pass-through': 'Proportion of incoming funds transferred out within a short window (e.g. <24h), leaving near-zero retention.',
  'fan-in': 'Layering pattern: multiple disparate accounts consolidating funds rapidly into a single intermediary account.',
  'fan-out': 'Smurfing pattern: rapid dispersal of accumulated funds to multiple downstream accounts or ATM cashouts.',
  'dormancy surge': 'Sudden surge of high-velocity transactions in an account with little or no prior historical activity.',
  'Louvain community': 'Graph community detection algorithm identifying clusters of accounts with unusually high internal connectivity.',
  'complaint distance': 'Graph distance (hops) to an account directly named in a cybercrime / police complaint.',
  'named': 'Account is explicitly named by a victim in an official cybercrime complaint.',
  '1 hop': 'Direct counterparty: transferred funds to or received funds directly from a complaint-named account.',
  'candidate link': 'Behavioral or structural similarity link inferred by algorithms; requires investigator corroboration.',
  'inflow': 'Total aggregate funds credited to this account across the monitored analysis period.',
  'median hold': 'Median duration (hours) funds remain in this account before being transferred out.',
};

export function Tooltip({ text, children, position = 'top' }: { text: React.ReactNode; children: React.ReactNode; position?: 'top' | 'bottom' }) {
  const [show, setShow] = React.useState(false);
  return (
    <span
      className="tooltip-trigger"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
      role="tooltip"
    >
      {children}
      {show && (
        <span
          className={`tooltip-popover ${position === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'} left-1/2 -translate-x-1/2`}
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function GlossaryTip({ term, label }: { term: string; label?: string }) {
  const definition = GLOSSARY[term.toLowerCase()] || GLOSSARY[term] || 'Financial crime analysis metric.';
  return (
    <Tooltip text={definition}>
      <span className="glossary-term">{label ?? term}</span>
    </Tooltip>
  );
}

/* ================================================================
   BREADCRUMBS (Feature 10: Speed of Recall)
   ================================================================ */
export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            {idx > 0 && <span className="text-ink-mute/50">/</span>}
            {isLast || !item.to ? (
              <span className="text-ink font-medium truncate max-w-[200px]">{item.label}</span>
            ) : (
              <a href={item.to} className="hover:text-brand transition-colors truncate max-w-[150px]">{item.label}</a>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/* ================================================================
   FILTER CHIPS (Feature 3: Recognition Rather Than Recall)
   ================================================================ */
export function FilterChipsBar({
  chips,
  onClearAll,
}: {
  chips: { id: string; label: string; onRemove: () => void }[];
  onClearAll?: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 py-1 animate-fade-in">
      <span className="text-[11px] font-semibold text-ink-mute uppercase tracking-wider">Active filters:</span>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="chip bg-brand-soft/20 text-brand border border-brand/30 py-1 px-2.5 text-[11px] gap-1.5 inline-flex items-center"
        >
          <span>{chip.label}</span>
          <button
            onClick={chip.onRemove}
            className="hover:text-white transition-colors ml-0.5"
            aria-label={`Remove filter ${chip.label}`}
          >
            ✕
          </button>
        </span>
      ))}
      {onClearAll && chips.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-[11px] text-ink-mute hover:text-brand underline ml-1 cursor-pointer transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

/* ================================================================
   COLLAPSIBLE CARD (Feature 7: Progressive Disclosure)
   ================================================================ */
export function CollapsibleCard({
  title,
  children,
  defaultOpen = true,
  right,
  badge,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="card p-5 mb-5 transition-all">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-ink-soft text-xs">{open ? '▼' : '▶'}</span>
          <h2 className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h2>
          {badge}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {right}
        </div>
      </div>
      {open && <div className="mt-4 pt-3 border-t border-line/60">{children}</div>}
    </div>
  );
}

/* ================================================================
   CONFIRMATION MODAL (Feature 5: Error Prevention)
   ================================================================ */
export function ConfirmModal({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className="text-[17px] font-bold tracking-tight text-ink" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h3>
        <div className="mt-2 text-[13px] text-ink-soft leading-relaxed">{description}</div>
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button className="btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className="btn"
            style={{
              background: danger ? 'var(--color-risk-crit)' : 'var(--color-brand)',
              color: '#fff',
              borderColor: danger ? 'var(--color-risk-crit)' : 'var(--color-brand)',
            }}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   TOAST NOTIFICATION & UNDO SYSTEM (Feature 4 & 8)
   ================================================================ */
export interface Toast {
  id: string;
  message: string;
  undoLabel?: string;
  onUndo?: () => void;
}

interface ToastContextType {
  showToast: (message: string, onUndo?: () => void, undoLabel?: string) => void;
}

const ToastContext = React.createContext<ToastContextType>({ showToast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const showToast = React.useCallback((message: string, onUndo?: () => void, undoLabel: string = 'Undo') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, onUndo, undoLabel }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5500);
  }, []);

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast-item">
            <span className="text-[13px] font-medium text-ink">{t.message}</span>
            <div className="flex items-center gap-2">
              {t.onUndo && (
                <button
                  className="chip cursor-pointer bg-brand/20 text-brand border-brand/40 hover:bg-brand/30 py-1"
                  onClick={() => {
                    t.onUndo?.();
                    removeToast(t.id);
                  }}
                >
                  {t.undoLabel}
                </button>
              )}
              <button
                className="text-ink-mute hover:text-ink text-xs px-1"
                onClick={() => removeToast(t.id)}
                aria-label="Close notification"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastContext);
}

