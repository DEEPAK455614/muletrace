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
  BANDS.find((b) => b.name === band)?.color ?? '#667085';

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

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-mute">{label}</div>
      <div className="mt-1.5 text-[26px] leading-8 font-semibold num" style={{ color: accent ?? 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-soft">{sub}</div>}
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
          <div className="mt-1 h-[5px] rounded-full bg-[#EFEDE8] overflow-hidden">
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
