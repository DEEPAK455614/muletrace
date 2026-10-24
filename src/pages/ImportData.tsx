import React, { useMemo, useState } from 'react';
import type { World } from '../engine/types';
import { parseCsv, autoMap, buildWorld, TXN_FIELDS, ACCOUNT_FIELDS, COMPLAINT_FIELDS, type ColumnMapping, type ImportResult } from '../engine/import';
import { SectionTitle } from '../ui';

const TXN_CANON = [
  { f: 'from', label: 'From account (required)' }, { f: 'to', label: 'To account (required)' },
  { f: 'amount', label: 'Amount INR (required)' }, { f: 'ts', label: 'Timestamp (required)' },
  { f: 'id', label: 'Transaction id (optional)' }, { f: 'channel', label: 'Channel (optional)' },
];
const ACCT_CANON = [
  { f: 'id', label: 'Account id (required)' }, { f: 'customerId', label: 'Customer id' },
  { f: 'bank', label: 'Bank' }, { f: 'ifsc', label: 'IFSC' }, { f: 'type', label: 'Account type' },
  { f: 'openedAt', label: 'Opened date' }, { f: 'city', label: 'City' }, { f: 'phone', label: 'Phone' },
];
const CMP_CANON = [
  { f: 'namedAccountIds', label: 'Named/suspect accounts (required)' }, { f: 'id', label: 'Reference' },
  { f: 'category', label: 'Category' }, { f: 'reportedAt', label: 'Reported date' },
  { f: 'amountLost', label: 'Amount lost' }, { f: 'victimAccountId', label: 'Victim account' },
  { f: 'city', label: 'City' }, { f: 'state', label: 'State' }, { f: 'summary', label: 'Summary' },
];

interface FileState { name: string; rows: string[][]; map: ColumnMapping; }

function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(file); });
}

function Mapper({ title, headers, canon, map, onChange }: {
  title: string; headers: string[]; canon: { f: string; label: string }[];
  map: ColumnMapping; onChange: (m: ColumnMapping) => void;
}) {
  return (
    <div className="mb-3">
      <div className="text-[12.5px] font-semibold mb-2">{title}</div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
        {canon.map(({ f, label }) => (
          <label key={f} className="flex items-center gap-2 text-[12px] text-ink-soft">
            <span className="w-[46%] shrink-0">{label}</span>
            <select className="input !py-1.5 text-[12px] flex-1" value={map[f] ?? ''}
              onChange={(e) => { const m = { ...map }; if (e.target.value) m[f] = e.target.value; else delete m[f]; onChange(m); }}>
              <option value="">- not mapped -</option>
              {headers.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function ImportData({ onWorld, activeKind, onReset }: {
  onWorld: (world: World, fileName: string, stats: ImportResult['stats']) => void;
  activeKind: 'synthetic' | 'uploaded';
  onReset: () => void;
}) {
  const [txn, setTxn] = useState<FileState | null>(null);
  const [acct, setAcct] = useState<FileState | null>(null);
  const [cmp, setCmp] = useState<FileState | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (file: File, kind: 'txn' | 'acct' | 'cmp') => {
    const text = await readFile(file);
    let rows: string[][];
    if (/\.json$/i.test(file.name)) {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : data[kind === 'txn' ? 'transactions' : kind === 'acct' ? 'accounts' : 'complaints'];
      if (!Array.isArray(arr) || !arr.length) throw new Error('JSON must contain a non-empty array.');
      const headers = Object.keys(arr[0]);
      rows = [headers, ...arr.map((o: Record<string, unknown>) => headers.map((h) => String(o[h] ?? '')))];
    } else {
      rows = parseCsv(text);
    }
    if (rows.length < 2) throw new Error('No data rows found.');
    const headers = rows[0];
    const map = autoMap(headers, kind === 'txn' ? TXN_FIELDS : kind === 'acct' ? ACCOUNT_FIELDS : COMPLAINT_FIELDS);
    const fs = { name: file.name, rows, map };
    if (kind === 'txn') setTxn(fs); else if (kind === 'acct') setAcct(fs); else setCmp(fs);
    setResult(null);
  };

  const run = () => {
    if (!txn) return;
    setBusy(true);
    // Engine run is synchronous; defer one tick so the button state paints.
    setTimeout(() => {
      const r = buildWorld(txn.rows, txn.map, acct?.rows ?? null, acct?.map ?? null, cmp?.rows ?? null, cmp?.map ?? null);
      setResult(r);
      setBusy(false);
      if (r.world) onWorld(r.world, txn.name, r.stats);
    }, 30);
  };

  const preview = useMemo(() => txn?.rows.slice(1, 4) ?? [], [txn]);

  return (
    <div className="max-w-[880px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Import dataset</h1>
        <p className="text-[13px] text-ink-soft mt-1 max-w-[720px]">
          Analyse your own transactions, accounts and complaints (CSV or JSON) with the same engine. Files are parsed
          locally in this browser - nothing is uploaded to any server. Imported data is <b>unverified</b>: scores rank
          suspicion for human review and are never proof of guilt, and no accuracy benchmark can be computed for unlabelled data.
        </p>
      </div>

      {activeKind === 'uploaded' && (
        <div className="card p-4 mb-4 flex items-center justify-between gap-3" style={{ borderColor: '#FFB02050', background: '#FFB02010' }}>
          <div className="text-[12.5px] text-ink-soft">An uploaded dataset is currently active across the dashboard.</div>
          <button className="btn" onClick={onReset}>Back to synthetic demo</button>
        </div>
      )}

      <div className="card p-5 mb-4">
        <SectionTitle>1 - Choose files</SectionTitle>
        <div className="grid sm:grid-cols-3 gap-3 mt-1">
          {([['txn', 'Transactions (required)'], ['acct', 'Accounts (optional)'], ['cmp', 'Complaints (optional)']] as const).map(([kind, label]) => (
            <label key={kind} className="card p-4 cursor-pointer text-center border-dashed hover:border-brand transition-colors">
              <input type="file" accept=".csv,.json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f, kind).catch((err) => setResult({ world: null, issues: [{ level: 'error', message: `${label}: ${err.message}` }], stats: { accounts: 0, txns: 0, complaints: 0, derivedAccounts: 0, skippedRows: 0 } })); }} />
              <div className="text-[12.5px] font-semibold">{label}</div>
              <div className="text-[11px] text-ink-mute mt-1">
                {(kind === 'txn' ? txn : kind === 'acct' ? acct : cmp)?.name ?? 'CSV or JSON'}
              </div>
            </label>
          ))}
        </div>
        <div className="text-[11.5px] text-ink-mute mt-3">
          Transactions need from-account, to-account, amount and timestamp columns. Without an accounts file, endpoint
          accounts are created with placeholder attributes. JSON: an array of objects, or {'{transactions, accounts, complaints}'}.
        </div>
      </div>

      {txn && (
        <div className="card p-5 mb-4">
          <SectionTitle>2 - Map columns</SectionTitle>
          <Mapper title={`Transactions - ${txn.name} (${txn.rows.length - 1} rows)`} headers={txn.rows[0]} canon={TXN_CANON} map={txn.map} onChange={(m) => setTxn({ ...txn, map: m })} />
          {acct && <Mapper title={`Accounts - ${acct.name}`} headers={acct.rows[0]} canon={ACCT_CANON} map={acct.map} onChange={(m) => setAcct({ ...acct, map: m })} />}
          {cmp && <Mapper title={`Complaints - ${cmp.name}`} headers={cmp.rows[0]} canon={CMP_CANON} map={cmp.map} onChange={(m) => setCmp({ ...cmp, map: m })} />}
          <div className="table-scroll mt-2"><table className="table-base">
            <thead><tr>{txn.rows[0].slice(0, 6).map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{preview.map((r, i) => <tr key={i}>{r.slice(0, 6).map((c, j) => <td key={j} className="text-[12px]">{c}</td>)}</tr>)}</tbody>
          </table></div>
        </div>
      )}

      {txn && (
        <div className="card p-5 mb-4">
          <SectionTitle>3 - Validate and run</SectionTitle>
          <button className="btn btn-primary" disabled={busy} onClick={run}>{busy ? 'Analysing…' : 'Run analysis on this data'}</button>
          {result && (
            <div className="mt-3 space-y-1.5">
              {result.issues.map((i, k) => (
                <div key={k} className="text-[12.5px]" style={{ color: i.level === 'error' ? 'var(--color-risk-crit)' : '#FFB020' }}>
                  {i.level === 'error' ? 'Error' : 'Note'}: {i.message}
                </div>
              ))}
              {result.world && (
                <div className="text-[12.5px] text-ink-soft">
                  Loaded {result.stats.txns} transactions across {result.stats.accounts} accounts
                  {result.stats.complaints ? ` and ${result.stats.complaints} complaints` : ''}
                  {result.stats.skippedRows ? ` (${result.stats.skippedRows} rows skipped)` : ''}. Dashboard updated.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

