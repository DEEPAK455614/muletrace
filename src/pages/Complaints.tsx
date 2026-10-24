import React, { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { Analysis } from '../engine';
import { ScoreBadge, SectionTitle, inrFull, fmtDate } from '../ui';

export default function Complaints({ a }: { a: Analysis }) {
  const nav = useNavigate();
  const d = useMemo(() => {
    const linked = a.world.complaints.filter((c) => c.namedAccountIds.length > 0);
    const unlinked = a.world.complaints.filter((c) => c.namedAccountIds.length === 0);
    // correlation: complaints sharing a community or a counterparty
    const communityOf = (c: (typeof linked)[number]) => {
      const id = c.namedAccountIds[0];
      return a.features.get(id)?.communityId ?? -1;
    };
    const byCommunity = new Map<number, string[]>();
    linked.forEach((c) => {
      const k = communityOf(c);
      byCommunity.set(k, [...(byCommunity.get(k) ?? []), c.id]);
    });
    const correlated = [...byCommunity.entries()].filter(([, v]) => v.length > 1);
    return { linked, unlinked, correlated };
  }, [a]);

  return (
    <div className="max-w-[1080px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Complaint correlation</h1>
        <p className="text-[13px] text-ink-soft mt-1">NCRP-style cybercrime complaints linked to in-consortium accounts, and clusters of complaints that share networks.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card p-4"><div className="num text-[22px] font-semibold">{a.world.complaints.length}</div><div className="text-[11px] text-ink-mute">Complaints on file</div></div>
        <div className="card p-4"><div className="num text-[22px] font-semibold">{d.linked.length}</div><div className="text-[11px] text-ink-mute">Linked to monitored accounts</div></div>
        <div className="card p-4"><div className="num text-[22px] font-semibold">{d.correlated.length}</div><div className="text-[11px] text-ink-mute">Correlated clusters</div></div>
      </div>

      {d.correlated.length > 0 && (
        <div className="card p-4 mb-4">
          <SectionTitle>Correlated complaint clusters</SectionTitle>
          {d.correlated.map(([cid, cids]) => (
            <div key={cid} className="p-3 rounded-lg border border-line mb-2 text-[13px]">
              <span className="font-semibold">Network #{cid}</span> - {cids.length} complaints name accounts in the same network community: <span className="num text-[12px] text-ink-soft">{cids.join(', ')}</span>
              <div className="text-[12px] text-ink-mute mt-1">Pattern suggests a single organised operation rather than isolated incidents.</div>
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
