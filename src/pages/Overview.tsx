import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Analysis } from '../engine';
import { Stat, SectionTitle, ScoreBadge, inr, bandColor } from '../ui';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import FlowGraph, { buildCommunities, buildLayout } from '../components/FlowGraph';
import { useNavigate } from 'react-router-dom';

export default function Overview({ a }: { a: Analysis }) {
  const nav = useNavigate();
  const hero = useMemo(() => {
    const cs = buildCommunities(a);
    const top = cs[0];
    return top ? { c: top, layout: buildLayout(a, top.members, 660, 400) } : null;
  }, [a]);
  const d = useMemo(() => {
    const scores = [...a.scores.values()];
    const alerts = scores.filter((s) => s.score >= 45).sort((x, y) => y.score - x.score);
    const bands = { Critical: 0, High: 0, Moderate: 0, Low: 0 } as Record<string, number>;
    scores.forEach((s) => bands[s.band]++);
    const flaggedAmount = alerts.reduce((sum, s) => sum + (a.features.get(s.accountId)?.inTotal ?? 0), 0);
    const complaintLinkedAlerts = alerts.filter((s) => (a.features.get(s.accountId)?.complaintDistance ?? 99) === 0).length;
    // weekly alert trend: first high-scoring activity week
    const weeks: number[] = [];
    return { alerts, bands, flaggedAmount, complaintLinkedAlerts, scores, weeks };
  }, [a]);

  const topNetworks = a.suspiciousCommunities.slice(0, 4);
  const custName = (id: string) => {
    const acc = a.world.accounts.find((x) => x.id === id);
    return a.world.customers.find((c) => c.id === acc?.customerId)?.name ?? id;
  };

  return (
    <div className="max-w-[1080px]">
      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Investigation overview</h1>
        <p className="text-[13px] text-ink-soft mt-1">Mule-account risk across the monitored consortium. Every score below is explainable - open any account to see exactly why it was flagged.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Accounts monitored" value={a.world.accounts.length.toLocaleString('en-IN')} sub={`${a.world.txns.length.toLocaleString('en-IN')} transactions${a.world.seed === 'uploaded' ? ' (uploaded)' : ', Jan-Oct 2026'}`} />
        <Stat label="Open alerts" value={d.alerts.length} sub={`${d.complaintLinkedAlerts} directly named in complaints`} accent="var(--color-risk-high)" />
        <Stat label="Suspicious networks" value={topNetworks.length} sub="Communities with concentrated risk signals" accent="var(--color-risk-crit)" />
        <Stat label="Complaints on file" value={a.world.complaints.length} sub="NCRP-style cybercrime reports" />
      </div>

      <div className="grid lg:grid-cols-5 gap-4 mb-6">
        <div className="card p-4 lg:col-span-2">
          <SectionTitle>Risk distribution</SectionTitle>
          <div className="space-y-2.5 mt-4">
            {(['Critical', 'High', 'Moderate', 'Low'] as const).map((b) => {
              const n = d.bands[b];
              const pct = (n / d.scores.length) * 100;
              return (
                <div key={b} className="flex items-center gap-3">
                  <div className="w-[70px] text-[12px] font-medium" style={{ color: bandColor(b) }}>{b}</div>
                  <div className="flex-1 h-[7px] rounded-full bg-[#16223A] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, n ? 1.5 : 0)}%`, background: bandColor(b) }} />
                  </div>
                  <div className="num w-[44px] text-right text-[12px] text-ink-soft">{n}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-line text-[12px] text-ink-soft leading-relaxed">
            Estimated funds touching alerted accounts: <span className="num font-semibold text-ink">{inr(d.flaggedAmount)}</span>.
            {a.world.seed === 'uploaded'
              ? 'Figures derive from the uploaded, unverified dataset - they demonstrate workflow, not confirmed exposure.'
              : 'Figures derive from the synthetic dataset - they demonstrate workflow, not real exposure.'}
          </div>
        </div>

        <div className="card p-4 lg:col-span-3 cursor-pointer" onClick={() => nav('/network')} title="Open network explorer">
          <SectionTitle right={<span className="text-[12px] font-medium" style={{ color: 'var(--color-brand)' }}>Open network explorer</span>}>
            Money movement - highest-risk network
          </SectionTitle>
          {hero && (
            <>
              <div className="text-[12px] text-ink-soft mt-1">
                Network #{hero.c.cid} - {hero.c.members.length} accounts - {hero.c.flagged.length} flagged - {hero.c.complaints.length} complaint-linked. Particles trace transaction direction and size.
              </div>
              <FlowGraph layout={hero.layout} width={660} height={400} />
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <SectionTitle>Highest-risk accounts</SectionTitle>
          <Link to="/alerts" className="flex items-center gap-1 text-[12px] font-medium no-underline mb-3" style={{ color: 'var(--color-brand)' }}>
            Full alert queue <ArrowRight size={13} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Account</th><th>Pattern</th><th>Complaint link</th><th className="text-right">Throughput</th><th className="text-right">Risk score</th></tr></thead>
            <tbody>
              {d.alerts.slice(0, 8).map((s) => {
                const f = a.features.get(s.accountId)!;
                const acc = a.world.accounts.find((x) => x.id === s.accountId)!;
                return (
                  <tr key={s.accountId} className="rowlink" onClick={() => (window.location.hash = `/accounts/${s.accountId}`)}>
                    <td>
                      <div className="font-medium text-[13px]">{custName(s.accountId)}</div>
                      <div className="num text-[11px] text-ink-mute">{s.accountId} - {acc.bank}</div>
                    </td>
                    <td className="text-[12px] text-ink-soft">{s.archetype}</td>
                    <td>{f.complaintDistance === 0 ? <span className="chip" style={{ color: 'var(--color-risk-crit)', background: '#FF4D5E12', borderColor: '#FF4D5E30' }}>Named</span> : f.complaintDistance === 1 ? <span className="chip" style={{ color: 'var(--color-risk-high)', background: '#FF7A4512', borderColor: '#FF7A4530' }}>1 hop</span> : <span className="text-[12px] text-ink-mute">None</span>}</td>
                    <td className="num text-right text-[12px]">{inr(f.inTotal)}</td>
                    <td className="text-right"><ScoreBadge score={s.score} band={s.band} size="sm" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
