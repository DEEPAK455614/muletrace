import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { Analysis } from '../engine';
import { ScoreBadge, SectionTitle, inrFull, fmtDate, Breadcrumbs, Tooltip, FilterChipsBar } from '../ui';

export default function Complaints({ a }: { a: Analysis }) {
  const nav = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [linkFilter, setLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all');

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

  const categories = useMemo(() => {
    return Array.from(new Set(a.world.complaints.map((c) => c.category)));
  }, [a]);

  const filteredComplaints = useMemo(() => {
    let list = [...d.linked, ...d.unlinked];
    if (categoryFilter !== 'all') {
      list = list.filter((c) => c.category === categoryFilter);
    }
    if (linkFilter === 'linked') {
      list = list.filter((c) => c.namedAccountIds.length > 0);
    } else if (linkFilter === 'unlinked') {
      list = list.filter((c) => c.namedAccountIds.length === 0);
    }
    return list;
  }, [d, categoryFilter, linkFilter]);

  const activeChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];
    if (categoryFilter !== 'all') {
      chips.push({ id: 'cat', label: `Category: ${categoryFilter}`, onRemove: () => setCategoryFilter('all') });
    }
    if (linkFilter !== 'all') {
      chips.push({ id: 'link', label: `Filter: ${linkFilter === 'linked' ? 'Linked only' : 'Unlinked only'}`, onRemove: () => setLinkFilter('all') });
    }
    return chips;
  }, [categoryFilter, linkFilter]);

  return (
    <div className="max-w-[1080px]">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Complaints' }]} />

      <div className="page-header">
        <h1>Complaint correlation</h1>
        <p>NCRP-style cybercrime complaints linked to in-consortium accounts, and clusters of complaints that share networks.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5 stat-grid">
        <div className="card p-4">
          <div className="num text-[22px] font-semibold">{a.world.complaints.length}</div>
          <div className="text-[11px] text-ink-mute">Complaints on file</div>
        </div>
        <div className="card p-4">
          <div className="num text-[22px] font-semibold text-brand">{d.linked.length}</div>
          <div className="text-[11px] text-ink-mute">Linked to monitored accounts</div>
        </div>
        <div className="card p-4">
          <div className="num text-[22px] font-semibold text-risk-crit">{d.correlated.length}</div>
          <div className="text-[11px] text-ink-mute">Correlated clusters</div>
        </div>
      </div>

      {d.correlated.length > 0 && (
        <div className="card p-5 mb-5">
          <SectionTitle>Correlated complaint clusters</SectionTitle>
          {d.correlated.map(([cid, cids]) => (
            <div key={cid} className="p-3.5 rounded-lg border border-line bg-surface/40 mb-2.5 text-[13px]">
              <span className="font-semibold text-ink">Network #{cid}</span> — {cids.length} complaints name accounts in the same network community: <span className="num text-[12px] text-brand">{cids.join(', ')}</span>
              <div className="text-[12px] text-ink-mute mt-1">Pattern suggests an organised syndicate operating across multiple accounts rather than isolated incidents.</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <select
          className="btn"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          className="btn"
          onClick={() => setLinkFilter(linkFilter === 'linked' ? 'all' : 'linked')}
          style={linkFilter === 'linked' ? { background: 'var(--color-brand)', color: '#fff', borderColor: 'var(--color-brand)' } : {}}
        >
          Linked only
        </button>
        <span className="text-[12px] text-ink-mute ml-auto num">
          Showing {filteredComplaints.length} of {a.world.complaints.length} complaints
        </span>
      </div>

      <FilterChipsBar
        chips={activeChips}
        onClearAll={() => {
          setCategoryFilter('all');
          setLinkFilter('all');
        }}
      />

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[720px]">
          <thead>
            <tr>
              <th>
                <Tooltip text="Official National Cyber Crime Reporting Portal (NCRP) reference number">
                  <span className="cursor-help">Reference ⓘ</span>
                </Tooltip>
              </th>
              <th>
                <Tooltip text="Reported fraud modus operandi">
                  <span className="cursor-help">Category ⓘ</span>
                </Tooltip>
              </th>
              <th>Reported</th>
              <th className="text-right">
                <Tooltip text="Reported financial loss by victim">
                  <span className="cursor-help">Amount lost ⓘ</span>
                </Tooltip>
              </th>
              <th>
                <Tooltip text="Beneficiary bank account cited by victim">
                  <span className="cursor-help">Named account ⓘ</span>
                </Tooltip>
              </th>
              <th className="text-right">
                <Tooltip text="Surag mule suspicion score for the cited account">
                  <span className="cursor-help">Account risk ⓘ</span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredComplaints.map((c) => {
              const accId = c.namedAccountIds[0];
              const s = accId ? a.scores.get(accId) : undefined;
              return (
                <tr key={c.id} className={accId ? 'rowlink' : ''} onClick={() => accId && nav(`/accounts/${accId}`)}>
                  <td className="num text-[12px]">{c.ref}</td>
                  <td className="text-[13px] font-medium">{c.category}</td>
                  <td className="text-[12px] text-ink-soft">{fmtDate(c.reportedAt)}</td>
                  <td className="num text-right text-[12px] font-medium">{inrFull(c.amountLost)}</td>
                  <td className="num text-[12px]">
                    {accId ? (
                      <span className="text-brand underline">{accId}</span>
                    ) : (
                      <span className="text-ink-mute">Outside consortium</span>
                    )}
                  </td>
                  <td className="text-right">
                    {s ? <ScoreBadge score={s.score} band={s.band} size="sm" /> : <span className="text-[12px] text-ink-mute">-</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredComplaints.length === 0 && (
          <div className="p-10 text-center text-sm text-ink-mute">
            No complaints match the selected filter.
          </div>
        )}
      </div>
      <div className="mt-3 text-[12px] text-ink-mute">
        Complaints without a named in-consortium account remain visible for correlation when beneficiary details arrive from other institutions.
      </div>
    </div>
  );
}
