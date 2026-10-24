import React from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Analysis } from '../engine';
import { ScoreBadge, FactorBars, SectionTitle, inrFull, fmtDate, fmtDateTime } from '../ui';
import { Printer, ArrowLeft } from 'lucide-react';

export default function ReportPage({ a }: { a: Analysis }) {
  const { id = '' } = useParams();
  const acc = a.world.accounts.find((x) => x.id === id);
  const cust = a.world.customers.find((c) => c.id === acc?.customerId);
  const score = a.scores.get(id);
  const f = a.features.get(id);
  if (!acc || !score || !f) return <div className="card p-10 text-center text-sm text-ink-mute">Account not found.</div>;

  const complaints = a.world.complaints.filter((c) => c.namedAccountIds.includes(id));
  const ins = a.world.txns.filter((t) => t.to === id).sort((x, y) => y.amount - x.amount).slice(0, 10);
  const outs = a.world.txns.filter((t) => t.from === id).sort((x, y) => y.amount - x.amount).slice(0, 10);
  const name = cust?.name ?? id;
  const now = new Date();

  const TxnRows = ({ txns, other }: { txns: typeof ins; other: 'from' | 'to' }) => (
    <>
      {txns.map((t) => (
        <tr key={t.id}>
          <td className="num text-[11px]">{fmtDateTime(t.ts)}</td>
          <td className="num text-[11px]">{t[other]}</td>
          <td className="num text-right text-[11px]">{inrFull(t.amount)}</td>
          <td className="text-[11px]">{t.channel}</td>
        </tr>
      ))}
    </>
  );

  return (
    <div className="max-w-[860px] report-print">
      <div className="flex gap-2 mb-4 no-print">
        <Link to={`/accounts/${id}`} className="btn no-underline"><ArrowLeft size={14} /> Back to account</Link>
        <button className="btn" onClick={() => window.print()}><Printer size={14} /> Print / save PDF</button>
      </div>

      <div className="card p-6 mb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-mute">Investigation evidence report</div>
        <h1 className="text-[22px] font-bold tracking-tight mt-1" style={{ fontFamily: 'var(--font-display)' }}>{name}</h1>
        <div className="num text-[12px] text-ink-mute mt-1">{acc.id} - {acc.bank} - {acc.ifsc}</div>
        <div className="text-[11px] text-ink-mute mt-1">Prepared {fmtDateTime(now.getTime())} - Surag synthetic demonstration environment</div>
        <div className="mt-4 flex items-center gap-4">
          <ScoreBadge score={score.score} band={score.band} size="lg" />
          <div className="text-[13px] text-ink-soft">{score.archetype}</div>
        </div>
        <div className="mt-4 p-3 rounded-lg text-[12px]" style={{ background: '#D99A1F10', border: '1px solid #D99A1F35', color: '#7A5410' }}>
          This report assembles evidence for human review. The risk score ranks suspicion; it is not a finding of guilt. Verify KYC documents, contact the customer, and follow internal governance before any account action. Demonstration data is synthetic.
        </div>
      </div>

      <div className="card p-5 mb-4">
        <SectionTitle>Subject</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[13px]">
          <div className="flex justify-between border-b border-line py-1.5"><span className="text-ink-soft">Customer</span><span>{cust?.name} ({cust?.occupation})</span></div>
          <div className="flex justify-between border-b border-line py-1.5"><span className="text-ink-soft">Declared income</span><span className="num">{inrFull(cust?.declaredIncome ?? 0)}/yr</span></div>
          <div className="flex justify-between border-b border-line py-1.5"><span className="text-ink-soft">Account opened</span><span className="num">{fmtDate(acc.openedAt)}</span></div>
          <div className="flex justify-between border-b border-line py-1.5"><span className="text-ink-soft">Device / address</span><span className="num text-[11px]">{acc.deviceId} / {acc.addressId}</span></div>
          <div className="flex justify-between border-b border-line py-1.5"><span className="text-ink-soft">Period inflow</span><span className="num">{inrFull(f.inTotal)}</span></div>
          <div className="flex justify-between border-b border-line py-1.5"><span className="text-ink-soft">Pass-through ≤24h</span><span className="num">{Math.round(f.passThrough24h * 100)}%</span></div>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <SectionTitle>Score rationale</SectionTitle>
        <FactorBars factors={score.factors} />
      </div>

      {complaints.length > 0 && (
        <div className="card p-5 mb-4">
          <SectionTitle>Complaints naming this account</SectionTitle>
          {complaints.map((c) => (
            <div key={c.id} className="p-3 rounded-lg border border-line mb-2 text-[13px]">
              <div className="flex justify-between"><span className="font-semibold">{c.category}</span><span className="num">{inrFull(c.amountLost)}</span></div>
              <div className="num text-[11px] text-ink-mute">{c.ref} - {fmtDate(c.reportedAt)} - {c.city}</div>
              <div className="text-ink-soft mt-1">{c.summary}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-5">
          <SectionTitle>Largest inbound</SectionTitle>
          <table className="table-base"><thead><tr><th>Time</th><th>From</th><th className="text-right">Amount</th><th>Channel</th></tr></thead><tbody><TxnRows txns={ins} other="from" /></tbody></table>
        </div>
        <div className="card p-5">
          <SectionTitle>Largest outbound</SectionTitle>
          <table className="table-base"><thead><tr><th>Time</th><th>To</th><th className="text-right">Amount</th><th>Channel</th></tr></thead><tbody><TxnRows txns={outs} other="to" /></tbody></table>
        </div>
      </div>

      <div className="text-[11px] text-ink-mute text-center pb-6">Surag - mule-account detection and financial fraud investigation (synthetic demonstration). Developed by Sahaj Solutions.</div>
    </div>
  );
}
