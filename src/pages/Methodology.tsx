import React from 'react';
import type { Analysis } from '../engine';
import { factorSpecs } from '../engine/scoring';
import type { AccountFeatures } from '../engine/features';
import { SectionTitle } from '../ui';

const TYPOLOGIES = [
  { name: 'Rapid dispersal (pass-through)', desc: 'Victim funds forwarded within minutes to hours, preserving most of the amount. Generational layering follows: one account receives from many victims, forwards to a smaller set of consolidators.', src: 'FCA multi-firm review; FATF illicit financial flows' },
  { name: 'Layering chains', desc: 'Funds hop through chains of accounts in consistent amounts within tight time windows, then exit to cash (ATM) or a merchant front.', src: 'Neo4j graph-analytics AML guidance; FATF' },
  { name: 'Structuring (smurfing)', desc: 'Deposits kept in the Rs 45,000-49,900 band to sit below round-number reporting scrutiny, aggregated into a business front.', src: 'RBIH NFPC study (arXiv); Outseer' },
  { name: 'Dormant activation', desc: 'A low-activity account suddenly carries high throughput inconsistent with its history - a classic recruited-mule tell.', src: 'FCA; Feedzai mule blueprint' },
  { name: 'Income inconsistency', desc: 'Annualised turnover far above declared income: no lawful source explains the observed flows.', src: 'Feedzai; Unit21' },
  { name: 'Network proximity to complaints', desc: 'Membership of communities containing complaint-named accounts, shared devices or addresses, and many-to-one dispersal structure.', src: 'Neo4j; Quantexa entity-resolution practice' },
];

export default function Methodology({ a }: { a: Analysis }) {
  const specs = factorSpecs({} as AccountFeatures);
  const totalW = specs.reduce((s, f) => s + f.max, 0);
  return (
    <div className="max-w-[880px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Methodology and limitations</h1>
        <p className="text-[13px] text-ink-soft mt-1">Full disclosure of how scores are produced, what the demonstration data is, and what this system does not claim.</p>
      </div>

      <div className="card p-5 mb-4">
        <SectionTitle>Detection typologies</SectionTitle>
        <p className="text-[12px] text-ink-soft mb-3">Feature design follows published money-mule typologies. Sources are research references, not endorsements.</p>
        <div className="space-y-3">
          {TYPOLOGIES.map((t) => (
            <div key={t.name} className="text-[13px]">
              <div className="font-semibold">{t.name}</div>
              <div className="text-ink-soft">{t.desc}</div>
              <div className="text-[11px] text-ink-mute mt-0.5">Basis: {t.src}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5 mb-4">
        <SectionTitle>Score composition ({specs.length} factors, max {totalW} points)</SectionTitle>
        <p className="text-[12px] text-ink-soft mb-3">Transparent, weighted, and fully explainable per factor on every account - reason codes rather than a black-box number. Weights were set once against the development dataset and frozen before any tuning of other components.</p>
        <div className="table-scroll"><table className="table-base">
          <thead><tr><th>Factor</th><th className="text-right">Max points</th><th>Share of model</th></tr></thead>
          <tbody>
            {specs.sort((x, y) => y.max - x.max).map((s) => (
              <tr key={s.label}>
                <td className="text-[13px]">{s.label}</td>
                <td className="num text-right">{s.max}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded bg-line overflow-hidden"><div className="h-full" style={{ width: `${(s.max / 30) * 100}%`, background: 'var(--color-brand)' }} /></div>
                    <span className="num text-[11px] text-ink-mute">{((s.max / totalW) * 100).toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="mt-3 text-[12px] text-ink-soft">Bands: Critical ≥ 75, High ≥ 45, Moderate 30-44. A complaint-evidence floor lifts accounts directly named in complaints with ≥ Rs 10,000 loss to at least 55.</div>
      </div>

      <div className="card p-5 mb-4">
        <SectionTitle>Demonstration data</SectionTitle>
        <div className="text-[13px] text-ink-soft space-y-2">
          <p>The demo runs on a fully synthetic consortium of <span className="num">{a.world.accounts.length}</span> accounts, <span className="num">{a.world.txns.length.toLocaleString('en-IN')}</span> transactions and <span className="num">{a.world.complaints.length}</span> complaints over the synthetic period, generated deterministically from a fixed seed. Normal behaviour models salaried, merchant, student and elderly profiles, festivals, rent cycles and market weekends.</p>
          <p>Six mule typologies are injected: rapid pass-through, layering chains, structuring, dormant activation, witting participants and round-tripping. Ground truth is used only for the evaluation report - never as a scoring feature. Any similarity to real persons is coincidental.</p>
        </div>
      </div>

      <div className="card p-5">
        <SectionTitle>Limitations - read before relying on any output</SectionTitle>
        <ul className="text-[13px] text-ink-soft space-y-2 list-disc pl-5">
          <li>Every score ranks suspicion for human review. It is not a finding of guilt and must never drive automated account action.</li>
          <li>Synthetic evaluation metrics measure recovery of the injected patterns only. They are not evidence of real-world performance; production deployment requires labelled bank data, independent model validation and governance sign-off.</li>
          <li>Complaint data covers a single consortium. CFCFRMS-style cross-bank flows, counter-bank balances and law-enforcement systems are out of scope.</li>
          <li>Known detector limits are stated on the Evaluation page, including controller roles that surface via network analysis rather than score.</li>
          <li>False positives are expected and visible: high-throughput merchants and landlords can resemble aggregation points. Triage includes a "likely legitimate" outcome and every factor is inspectable.</li>
        </ul>
      </div>
    </div>
  );
}
