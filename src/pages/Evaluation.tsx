import React from 'react';
import type { Analysis } from '../engine';
import { SectionTitle } from '../ui';
import benchmark from '../data/benchmark.json';

type BenchEval = {
  threshold: number; precision: number; recall: number; falseAlarmRate: number;
  tp: number; fp: number; fn: number; tn: number;
  hardNegatives: { id: string; note: string; score: number; flagged: boolean }[];
  hardNegativesFlagged: number;
};
const rules = benchmark.rules as unknown as Record<string, BenchEval>;
const ml = benchmark.ml as unknown as Record<string, BenchEval>;
const worlds = Object.keys(rules);

export default function Evaluation({ a }: { a: Analysis }) {
  const e = a.evaluation;
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const maxP = Math.max(...e.prCurve.map((p) => p.precision), 0.01);
  const WORLD_LABEL: Record<string, string> = { dev: 'Dev (tuning)', validation: 'Validation (threshold)', 'holdout-1': 'Holdout 1 (untouched)', 'holdout-2': 'Holdout 2 (untouched)' };

  const CompareTable = ({ data, title }: { data: Record<string, BenchEval>; title: string }) => (
    <div className="card p-4 mb-4">
      <SectionTitle>{title}</SectionTitle>
      <div className="table-scroll"><table className="table-base">
        <thead><tr><th>World</th><th className="text-right">Threshold</th><th className="text-right">Precision</th><th className="text-right">Recall</th><th className="text-right">False-alarm</th><th className="text-right">Caught</th><th className="text-right">FP</th><th className="text-right">Hard-neg flagged</th></tr></thead>
        <tbody>
          {worlds.map((w) => (
            <tr key={w}>
              <td className="text-[13px]">{WORLD_LABEL[w] ?? w}</td>
              <td className="num text-right">{data[w].threshold}</td>
              <td className="num text-right">{pct(data[w].precision)}</td>
              <td className="num text-right">{pct(data[w].recall)}</td>
              <td className="num text-right">{pct(data[w].falseAlarmRate)}</td>
              <td className="num text-right">{data[w].tp}/{data[w].tp + data[w].fn}</td>
              <td className="num text-right">{data[w].fp}</td>
              <td className="num text-right" style={{ color: data[w].hardNegativesFlagged > 0 ? '#D99A1F' : '#1F9D6B' }}>{data[w].hardNegativesFlagged}/{data[w].hardNegatives.length}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );

  return (
    <div className="max-w-[1080px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Evaluation - synthetic benchmark</h1>
        <p className="text-[13px] text-ink-soft mt-1 max-w-[760px]">
          These numbers measure how well each scorer recovers the fraud scenarios injected into generated worlds.
          They are not evidence of real-world performance. Dev numbers are optimistic by construction;
          the honest estimate is the untouched-holdout rows, and even those only describe this generator.
        </p>
      </div>

      <div className="card p-4 mb-4" style={{ borderColor: '#3B4BD830', background: '#3B4BD808' }}>
        <SectionTitle>Protocol and provenance</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[12.5px] text-ink-soft">
          <div>- Rule weights frozen on dev world <span className="num">{benchmark.protocol.devSeed}</span>; never re-tuned.</div>
          <div>- ML model (logistic regression, {benchmark.protocol.featureKeys.length} observed features) trained only on dev: <span className="num">{benchmark.protocol.trainCounts.positives}</span> positive / <span className="num">{benchmark.protocol.trainCounts.negatives}</span> negative accounts.</div>
          <div>- Threshold <span className="num">{benchmark.protocol.threshold}</span>: {benchmark.protocol.thresholdRule} (<span className="num">{benchmark.protocol.validationSeed}</span>).</div>
          <div>- Holdout worlds <span className="num">{benchmark.protocol.holdoutSeeds.join(', ')}</span> evaluated exactly once, after the freeze.</div>
          <div>- No direct generator-label feature: features use transactions, complaints and graph structure only; ground truth is used for evaluation and dev-only training. Complaint-dependent proxy leakage remains - see Validity limits below.</div>
          <div>- Protocol run at <span className="num">{new Date(benchmark.protocol.trainedAtUtc).toLocaleString('en-IN')}</span>.</div>
        </div>
      </div>

      <CompareTable data={rules} title="Rule engine (transparent weighted factors, frozen)" />
      <CompareTable data={ml} title="Trained model (logistic regression, dev-trained)" />

      <div className="card p-4 mb-4">
        <SectionTitle>Benign hard negatives (holdout 1) - the false-positive traps</SectionTitle>
        <p className="text-[12px] text-ink-soft mb-3">Deliberately injected legitimate patterns that resemble mule behaviour. A flagged row is a detector failure, shown openly rather than suppressed.</p>
        <div className="table-scroll"><table className="table-base">
          <thead><tr><th>Legitimate pattern</th><th className="text-right">Rules score</th><th className="text-right">ML score</th><th className="text-right">Verdict</th></tr></thead>
          <tbody>
            {rules['holdout-1'].hardNegatives.map((h, i) => {
              const m = ml['holdout-1'].hardNegatives[i];
              const anyFlag = h.flagged || m?.flagged;
              return (
                <tr key={h.id}>
                  <td className="text-[12px]">{h.note}</td>
                  <td className="num text-right">{h.score}</td>
                  <td className="num text-right">{m?.score ?? '-'}</td>
                  <td className="num text-right text-[12px]" style={{ color: anyFlag ? '#D99A1F' : '#1F9D6B' }}>{anyFlag ? 'False positive' : 'Correctly cleared'}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <div className="mt-3 text-[12px] text-ink-soft leading-relaxed">
          The kitty organizer and family remittance pooler are flagged by the rule engine: their fan-in/fan-out and same-day forwarding genuinely resemble mule structure. Separating committee-style rotation from fraud needs periodicity and counterparty-relationship evidence - recorded as known limitations and future work.
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <SectionTitle>Analyst queue quality - dev world (rules)</SectionTitle>
          <p className="text-[12px] text-ink-soft mb-3">Investigators work a ranked queue, not a threshold. Precision at the top of the queue is what a review team actually experiences.</p>
          <div className="table-scroll"><table className="table-base">
            <thead><tr><th>Queue depth</th><th className="text-right">Precision</th><th className="text-right">Recall</th></tr></thead>
            <tbody>
              {e.precisionAtK.map((p) => (
                <tr key={p.k}><td className="num">Top {p.k}</td><td className="num text-right">{pct(p.precision)}</td><td className="num text-right">{pct(p.recall)}</td></tr>
              ))}
            </tbody>
          </table></div>
        </div>
        <div className="card p-4">
          <SectionTitle>Precision-recall curve - dev world (rules)</SectionTitle>
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
        <SectionTitle>Per-scenario detection - dev world (rules)</SectionTitle>
        <div className="table-scroll"><table className="table-base">
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
        </table></div>
        <div className="mt-3 text-[12px] text-ink-soft leading-relaxed">
          Herder and merchant off-ramp accounts carry little transactional signal by design; they surface through the network view, echoing the FCA finding that link analysis - not scoring - uncovers controllers. Confusion at threshold: TP {e.tp}, FP {e.fp}, FN {e.fn}, TN {e.tn}.
        </div>
      </div>
    </div>
  );
}
