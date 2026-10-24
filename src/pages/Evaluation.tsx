import React from 'react';
import type { Analysis } from '../engine';
import { SectionTitle } from '../ui';

export default function Evaluation({ a }: { a: Analysis }) {
  const e = a.evaluation;
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const maxP = Math.max(...e.prCurve.map((p) => p.precision), 0.01);
  return (
    <div className="max-w-[1080px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Evaluation - synthetic benchmark</h1>
        <p className="text-[13px] text-ink-soft mt-1 max-w-[720px]">
          These numbers measure how well the scoring engine recovers the fraud scenarios injected into THIS synthetic dataset.
          They are not evidence of real-world performance. Real deployment needs labelled bank data, model validation and governance.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="card p-4"><div className="num text-[22px] font-semibold">{pct(e.precision)}</div><div className="text-[11px] text-ink-mute">Precision at alert threshold ({e.threshold})</div></div>
        <div className="card p-4"><div className="num text-[22px] font-semibold">{pct(e.recall)}</div><div className="text-[11px] text-ink-mute">Recall of injected scenarios</div></div>
        <div className="card p-4"><div className="num text-[22px] font-semibold">{pct(e.falseAlarmRate)}</div><div className="text-[11px] text-ink-mute">False-alarm rate ({e.fp} of {e.fp + e.tn})</div></div>
        <div className="card p-4"><div className="num text-[22px] font-semibold">{e.tp}/{e.positives}</div><div className="text-[11px] text-ink-mute">Injected accounts flagged</div></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <SectionTitle>Analyst queue quality (precision @ depth)</SectionTitle>
          <p className="text-[12px] text-ink-soft mb-3">Investigators work a ranked queue, not a threshold. Precision at the top of the queue is what a review team actually experiences.</p>
          <table className="table-base">
            <thead><tr><th>Queue depth</th><th className="text-right">Precision</th><th className="text-right">Recall</th></tr></thead>
            <tbody>
              {e.precisionAtK.map((p) => (
                <tr key={p.k}><td className="num">Top {p.k}</td><td className="num text-right">{pct(p.precision)}</td><td className="num text-right">{pct(p.recall)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-4">
          <SectionTitle>Precision-recall curve (synthetic)</SectionTitle>
          <svg viewBox="0 0 400 210" className="w-full mt-2">
            <line x1={40} y1={180} x2={380} y2={180} stroke="#E4E2DC" />
            <line x1={40} y1={20} x2={40} y2={180} stroke="#E4E2DC" />
            <text x={200} y={202} textAnchor="middle" fontSize={10} fill="#8A93A3">Recall</text>
            <text x={12} y={100} fontSize={10} fill="#8A93A3" transform="rotate(-90 14 100)">Precision</text>
            <polyline
              fill="none" stroke="#3B4BD8" strokeWidth={2}
              points={e.prCurve.map((p) => `${40 + p.recall * 340},${180 - (p.precision / maxP) * 150}`).join(' ')}
            />
            {e.prCurve.map((p) => (
              <circle key={p.threshold} cx={40 + p.recall * 340} cy={180 - (p.precision / maxP) * 150} r={p.threshold === e.threshold ? 4 : 2.5}
                fill={p.threshold === e.threshold ? '#D92D20' : '#3B4BD8'} opacity={p.threshold === e.threshold ? 1 : 0.55} />
            ))}
          </svg>
          <div className="text-[11px] text-ink-mute mt-1">Red dot = operating threshold {e.threshold}. Y-axis scaled to best precision ({pct(maxP)}).</div>
        </div>
      </div>

      <div className="card p-4">
        <SectionTitle>Per-scenario detection</SectionTitle>
        <table className="table-base">
          <thead><tr><th>Injected scenario</th><th className="text-right">Accounts</th><th className="text-right">Flagged</th><th className="text-right">Detection</th></tr></thead>
          <tbody>
            {e.perScenario.map((s) => (
              <tr key={s.ring}>
                <td className="text-[13px]">{s.title}</td>
                <td className="num text-right">{s.size}</td>
                <td className="num text-right">{s.detected}</td>
                <td className="num text-right" style={{ color: s.detected === s.size ? '#1F9D6B' : s.detected > 0 ? '#D99A1F' : '#D92D20' }}>{pct(s.detected / s.size)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 text-[12px] text-ink-soft leading-relaxed">
          Herder and merchant off-ramp accounts carry little transactional signal by design; they surface through the network view, echoing the FCA finding that link analysis - not scoring - uncovers controllers. Confusion at threshold: TP {e.tp}, FP {e.fp}, FN {e.fn}, TN {e.tn}.
        </div>
      </div>
    </div>
  );
}
