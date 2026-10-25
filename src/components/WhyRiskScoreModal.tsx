import React from 'react';
import { Link } from 'react-router-dom';
import type { Analysis } from '../engine';
import { ScoreBadge, FactorBars, inr } from '../ui';
import { X, Sparkles, ExternalLink, GitBranch } from 'lucide-react';

interface Props {
  accountId: string | null;
  onClose: () => void;
  a: Analysis;
  mode?: 'modal' | 'card';
}

export function WhyRiskScoreModal({ accountId, onClose, a, mode = 'modal' }: Props) {
  if (!accountId) return null;

  const acc = a.world.accounts.find((x) => x.id === accountId);
  const cust = a.world.customers.find((c) => c.id === acc?.customerId);
  const score = a.scores.get(accountId);
  const f = a.features.get(accountId);

  if (!score || !f) return null;

  const name = cust?.name ?? accountId;

  const content = (
    <div className="card p-5 max-w-[460px] w-full border border-brand/25 bg-[#0B1220]/95 backdrop-blur-xl shadow-2xl animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[16px] font-bold text-ink truncate" style={{ fontFamily: 'var(--font-display)' }}>
              {name}
            </h3>
            <ScoreBadge score={score.score} band={score.band} size="sm" />
          </div>
          <div className="num text-[11px] text-ink-mute mt-0.5">
            {accountId} • {acc?.bank ?? 'Bank'} • {acc?.type === 'current' ? 'Current' : 'Savings'}
          </div>
          <div className="text-[12px] text-ink-soft mt-1">
            Observed pattern: <span className="text-ink font-medium">{score.archetype}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-ink-mute hover:text-ink hover:bg-surface/60 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={17} />
        </button>
      </div>

      {/* Why this risk score section */}
      <div className="border-t border-line/70 pt-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-brand flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display)' }}>
            <Sparkles size={14} className="text-brand" />
            Why this risk score ({score.score}/100)
          </span>
          <span className="text-[11px] num text-ink-mute">
            {score.factors.length} active factor{score.factors.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="max-h-[240px] overflow-y-auto pr-1 space-y-2.5" style={{ scrollbarWidth: 'thin' }}>
          <FactorBars factors={score.factors} />
        </div>
      </div>

      {/* Key metrics overview */}
      <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg border border-line bg-surface/50 text-center mb-3.5">
        <div>
          <div className="num text-[13px] font-semibold text-ink">{inr(f.inTotal)}</div>
          <div className="text-[10px] text-ink-mute">Total inflow</div>
        </div>
        <div>
          <div className="num text-[13px] font-semibold text-ink">{Math.round(f.passThrough24h * 100)}%</div>
          <div className="text-[10px] text-ink-mute">Out &lt;24h</div>
        </div>
        <div>
          <div className="num text-[13px] font-semibold" style={{ color: f.complaintDistance === 0 ? 'var(--color-risk-crit)' : f.complaintDistance === 1 ? 'var(--color-risk-high)' : 'var(--color-ink-mute)' }}>
            {f.complaintDistance === 0 ? 'Named' : f.complaintDistance === 1 ? '1 hop' : '-'}
          </div>
          <div className="text-[10px] text-ink-mute">Complaint</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-line/60">
        <Link
          to={`/accounts/${accountId}`}
          className="btn !py-1.5 !px-3 text-xs flex-1 justify-center no-underline"
          style={{ background: 'var(--color-brand)', color: '#000', fontWeight: 600, borderColor: 'var(--color-brand)' }}
        >
          Full Account 360 <ExternalLink size={12} />
        </Link>
        <Link
          to={`/trails?account=${accountId}`}
          className="btn !py-1.5 !px-3 text-xs justify-center no-underline"
        >
          <GitBranch size={12} /> Trace funds
        </Link>
      </div>
    </div>
  );

  if (mode === 'card') {
    return content;
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div onClick={(e) => e.stopPropagation()} className="animate-scale">
        {content}
      </div>
    </div>
  );
}
