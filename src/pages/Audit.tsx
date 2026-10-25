import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Analysis } from '../engine';
import { SectionTitle, Breadcrumbs, Tooltip } from '../ui';
import { loadAuditLog, verifyAuditChain, type AuditEntry, type ChainCheck } from '../state/audit';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

export default function Audit({ a }: { a: Analysis }) {
  const [log, setLog] = useState<AuditEntry[]>([]);
  const [check, setCheck] = useState<ChainCheck | null>(null);

  useEffect(() => {
    const l = loadAuditLog();
    setLog(l);
    verifyAuditChain(l).then(setCheck);
  }, []);

  const nameOf = (id?: string) => {
    if (!id) return '-';
    const acct = a.world.accounts.find((x) => x.id === id);
    const cust = acct ? a.world.customers.find((c) => c.id === acct.customerId) : undefined;
    return cust ? `${cust.name} (${id})` : id;
  };

  return (
    <div className="max-w-[1080px]">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Audit trail' }]} />

      <div className="page-header">
        <h1>Investigative audit trail</h1>
        <p>
          Browser-local record of triage status changes. Each entry chains to the previous one with cryptographic SHA-256 hashes, ensuring tamper-evident logging of investigator review decisions.
        </p>
      </div>

      <div className="card p-4 mb-4 flex items-center gap-3">
        {check === null ? (
          <span className="text-[13px] text-ink2">Verifying chain...</span>
        ) : check.ok ? (
          <>
            <ShieldCheck size={20} style={{ color: 'var(--color-ok)' }} />
            <div>
              <div className="text-[14px] font-semibold">Chain intact</div>
              <div className="text-[12px] text-ink2">{check.checked} entries verified, each hash matches its recorded predecessor.</div>
            </div>
          </>
        ) : (
          <>
            <ShieldAlert size={20} style={{ color: 'var(--color-danger)' }} />
            <div>
              <div className="text-[14px] font-semibold">Chain broken at entry {check.brokenAt}</div>
              <div className="text-[12px] text-ink2">A past entry was modified or removed - do not rely on this trail.</div>
            </div>
          </>
        )}
      </div>

      {log.length === 0 ? (
        <div className="card p-6 text-[13px] text-ink2">
          No triage status changes recorded yet. Set a triage status on any account from the alert queue and it will appear here.
        </div>
      ) : (
        <div className="card">
          <div className="table-scroll">
            <table className="table-base">
              <thead>
                <tr><th>#</th><th>Time</th><th>Action</th><th>Account</th><th>Detail</th><th className="text-right">Hash</th></tr>
              </thead>
              <tbody>
                {[...log].reverse().map((e) => (
                  <tr key={e.seq}>
                    <td className="text-ink3">{e.seq + 1}</td>
                    <td className="whitespace-nowrap">{new Date(e.ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span className="chip">{e.action}</span></td>
                    <td>{e.accountId ? <Link to={`/accounts/${e.accountId}`} className="text-brand hover:underline">{nameOf(e.accountId)}</Link> : '-'}</td>
                    <td className="text-ink2">{e.detail}</td>
                    <td className="text-right font-mono text-[11px] text-ink3" title={e.hash}>{e.hash.slice(0, 10)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
