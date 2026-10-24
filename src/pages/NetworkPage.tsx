import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Analysis } from '../engine';
import { ScoreBadge, SectionTitle, inr } from '../ui';

export default function NetworkPage({ a }: { a: Analysis }) {
  const nav = useNavigate();
  const [selected, setSelected] = useState<number | null>(null);

  const communities = useMemo(() => {
    const byCommunity = new Map<number, string[]>();
    for (const [id, f] of a.features) {
      byCommunity.set(f.communityId, [...(byCommunity.get(f.communityId) ?? []), id]);
    }
    return [...byCommunity.entries()].map(([cid, members]) => {
      const scores = members.map((m) => a.scores.get(m)?.score ?? 0);
      const complaints = a.world.complaints.filter((c) => c.namedAccountIds.some((id) => members.includes(id)));
      const maxScore = Math.max(...scores, 0);
      const flagged = members.filter((m) => (a.scores.get(m)?.score ?? 0) >= 45);
      const flow = members.reduce((s, m) => s + (a.features.get(m)?.inTotal ?? 0), 0);
      return { cid, members, maxScore, flagged, complaints, flow, avg: scores.reduce((s, x) => s + x, 0) / members.length };
    }).filter((c) => c.maxScore >= 30 || c.complaints.length > 0)
      .sort((x, y) => y.maxScore - x.maxScore || y.flagged.length - x.flagged.length);
  }, [a]);

  const nameOf = (id: string) => {
    const acc = a.world.accounts.find((x) => x.id === id);
    return a.world.customers.find((c) => c.id === acc?.customerId)?.name ?? id;
  };
  const sel = communities.find((c) => c.cid === selected);

  return (
    <div className="max-w-[1080px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Network intelligence</h1>
        <p className="text-[13px] text-ink-soft mt-1">
          Transaction communities (Louvain) ranked by peak member risk. Community membership is how controllers, collectors and off-ramps surface - the FCA pattern: link analysis reveals roles that account-level scores miss.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-2">
          {communities.map((c) => (
            <button key={c.cid} className="card w-full text-left p-3 cursor-pointer transition-shadow hover:shadow-md"
              style={selected === c.cid ? { borderColor: 'var(--color-brand)', boxShadow: '0 0 0 1px var(--color-brand)' } : {}}
              onClick={() => setSelected(c.cid)}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[13px]">Network #{c.cid}</span>
                <span className="num text-[12px]" style={{ color: c.maxScore >= 75 ? 'var(--color-risk-crit)' : c.maxScore >= 45 ? 'var(--color-risk-high)' : 'var(--color-ink-mute)' }}>peak {Math.round(c.maxScore)}</span>
              </div>
              <div className="text-[11px] text-ink-mute mt-1">
                {c.members.length} accounts - {c.flagged.length} flagged - {c.complaints.length} complaint{c.complaints.length === 1 ? '' : 's'} - {inr(c.flow)} inflow
              </div>
            </button>
          ))}
        </div>
        <div className="lg:col-span-3">
          {!sel ? (
            <div className="card p-10 text-center text-[13px] text-ink-mute">Select a network to inspect its members, complaints and structure.</div>
          ) : (
            <div className="card p-4">
              <SectionTitle>Network #{sel.cid} - {sel.members.length} accounts</SectionTitle>
              <div className="text-[12px] text-ink-soft mb-3">{sel.complaints.length} linked complaint{sel.complaints.length === 1 ? '' : 's'} - combined inflow {inr(sel.flow)} - average member score {Math.round(sel.avg)}</div>
              <table className="table-base">
                <thead><tr><th>Account</th><th>Pattern</th><th className="text-right">Inflow</th><th className="text-right">Score</th></tr></thead>
                <tbody>
                  {[...sel.members].sort((x, y) => (a.scores.get(y)?.score ?? 0) - (a.scores.get(x)?.score ?? 0)).map((m) => {
                    const s = a.scores.get(m)!;
                    const f = a.features.get(m)!;
                    return (
                      <tr key={m} className="rowlink" onClick={() => nav(`/accounts/${m}`)}>
                        <td>
                          <div className="text-[13px] font-medium">{nameOf(m)}</div>
                          <div className="num text-[11px] text-ink-mute">{m}</div>
                        </td>
                        <td className="text-[12px] text-ink-soft">{s.archetype}</td>
                        <td className="num text-right text-[12px]">{inr(f.inTotal)}</td>
                        <td className="text-right"><ScoreBadge score={s.score} band={s.band} size="sm" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sel.complaints.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line">
                  <div className="text-[12px] font-semibold text-ink-soft mb-1.5">Linked complaints</div>
                  {sel.complaints.map((c) => (
                    <div key={c.id} className="text-[12px] text-ink-soft mb-1"><span className="num">{c.ref}</span> - {c.category} - {inr(c.amountLost)}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
