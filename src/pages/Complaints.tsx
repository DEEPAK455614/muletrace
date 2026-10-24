import React, { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { Analysis } from '../engine';
import type { Complaint } from '../engine/types';
import { ScoreBadge, SectionTitle, inrFull, fmtDate } from '../ui';

export default function Complaints({ a }: { a: Analysis }) {
  const nav = useNavigate();
  const d = useMemo(() => {
    const linked = a.world.complaints.filter((c) => c.namedAccountIds.length > 0);
    const unlinked = a.world.complaints.filter((c) => c.namedAccountIds.length === 0);

    // Direct-evidence correlation: union complaints that name the SAME account.
    const parent = new Map<string, string>();
    const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; return r; };
    const union = (x: string, y: string) => { parent.set(find(x), find(y)); };
    linked.forEach((c) => parent.set(c.id, c.id));
    const firstByAccount = new Map<string, string>();
    for (const c of linked) for (const id of c.namedAccountIds) {
      const prev = firstByAccount.get(id);
      if (prev) union(prev, c.id); else firstByAccount.set(id, c.id);
    }
    const byRoot = new Map<string, Complaint[]>();
    for (const c of linked) { const r = find(c.id); byRoot.set(r, [...(byRoot.get(r) ?? []), c]); }
    const sharedClusters = [...byRoot.values()]
      .filter((v) => v.length > 1)
      .map((cs) => {
        const counts = new Map<string, number>();
        cs.forEach((c) => c.namedAccountIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1)));
        const bridges = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        return { complaints: cs.sort((x, y) => x.reportedAt - y.reportedAt), bridges };
      })
      .sort((x, y) => y.complaints.length - x.complaints.length);

    // Graph-inferred correlation: complaints naming accounts in the same network community
    // (weaker - derived from transaction structure, not shared named accounts).
    const communityOf = (c: Complaint) => a.features.get(c.namedAccountIds[0])?.communityId ?? -1;
    const byCommunity = new Map<number, Complaint[]>();
    linked.forEach((c) => { const k = communityOf(c); byCommunity.set(k, [...(byCommunity.get(k) ?? []), c]); });
    const communityClusters = [...byCommunity.entries()].filter(([, v]) => v.length > 1);
    return { linked, unlinked, sharedClusters, communityClusters };
  }, [a]);

  const nameOf = (accId: string) =>
    a.world.customers.find((c) => c.id === a.world.accounts.find((x) => x.id === accId)?.customerId)?.name ?? accId;

  return (
    <div className="max-w-[1080px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Complaint correlation</h1>
        <p className="text-[13px] text-ink-soft mt-1">NCRP-style cybercrime complaints linked to in-consortium accounts. Clusters surface complaints that may describe related incidents - for investigator review, not a conclusion of coordination.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card p-4"><div className="num text-[22px] font-semibold">{a.world.complaints.length}</div><div className="text-[11px] text-ink-mute">Complaints on file</div></div>
        <div className="card p-4"><div className="num text-[22px] font-semibold">{d.linked.length}</div><div className="text-[11px] text-ink-mute">Linked to monitored accounts</div></div>
        <div className="card p-4"><div className="num text-[22px] font-semibold">{d.sharedClusters.length}</div><div className="text-[11px] text-ink-mute">Clusters sharing named accounts</div></div>
      </div>

      {d.sharedClusters.length > 0 && (
        <div className="card p-4 mb-4">
          <SectionTitle>Clusters: complaints naming the same accounts</SectionTitle>
          <div className="text-[11.5px] text-ink-mute mb-3">Direct evidence link - the same beneficiary account appears in multiple complaints. Worth reviewing as potentially related incidents; shared accounts alone do not establish coordination.</div>
          {d.sharedClusters.map((cl, i) => (
            <div key={i} className="p-3 rounded-lg border border-line mb-2">
              <div className="text-[13px] font-semibold mb-1.5">{cl.complaints.length} complaints via {cl.bridges.length === 1 ? 'account' : 'accounts'} {cl.bridges.flatMap((id, i) => [
                i > 0 ? <span key={`sep-${id}`}>, </span> : null,
                <Link key={id} to={`/?account=${id}`} className="text-brand no-underline hover:underline num text-[12px]">{id} ({nameOf(id)})</Link>,
              ])}</div>
              {cl.complaints.map((c) => (
                <div key={c.id} className="flex flex-wrap items-baseline gap-x-2 text-[12px] py-0.5">
                  <span className="num text-ink-soft">{c.ref}</span>
                  <span>{c.category}</span>
                  <span className="text-ink-mute">{fmtDate(c.reportedAt)} - {c.city}</span>
                  <span className="num text-risk-crit font-medium ml-auto">{inrFull(c.amountLost)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {d.communityClusters.length > 0 && (
        <div className="card p-4 mb-4">
          <SectionTitle>Same network community (graph-inferred)</SectionTitle>
          <div className="text-[11.5px] text-ink-mute mb-3">Weaker link - these complaints name different accounts that sit in the same transaction-graph community. Structure is inferred; treat as a lead for review, not evidence of a common operation.</div>
          {d.communityClusters.map(([cid, cs]) => (
            <div key={cid} className="p-3 rounded-lg border border-line mb-2 text-[12.5px]">
              <span className="font-semibold">Network #{cid}</span> - {cs.length} complaints: <span className="num text-[12px] text-ink-soft">{cs.map((c) => c.ref).join(', ')}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[720px]">
          <thead><tr><th>Reference</th><th>Category</th><th>Reported</th><th className="text-right">Amount lost</th><th>Named account</th><th className="text-right">Account risk</th></tr></thead>
          <tbody>
            {[...d.linked, ...d.unlinked].map((c) => {
              const accId = c.namedAccountIds[0];
              const s = accId ? a.scores.get(accId) : undefined;
              return (
                <tr key={c.id} className={accId ? 'rowlink' : ''} onClick={() => accId && nav(`/accounts/${accId}`)}>
                  <td className="num text-[12px]">{c.ref}</td>
                  <td className="text-[13px]">{c.category}</td>
                  <td className="text-[12px] text-ink-soft">{fmtDate(c.reportedAt)}</td>
                  <td className="num text-right text-[12px]">{inrFull(c.amountLost)}</td>
                  <td className="num text-[12px]">{accId ?? <span className="text-ink-mute">Outside consortium</span>}</td>
                  <td className="text-right">{s ? <ScoreBadge score={s.score} band={s.band} size="sm" /> : <span className="text-[12px] text-ink-mute">-</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-[12px] text-ink-mute">
        Complaints without a named in-consortium account remain visible for correlation when beneficiary details arrive from other institutions (CFCFRMS-style inter-bank flow is out of scope for this demo).
      </div>
    </div>
  );
}
