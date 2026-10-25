// FR-03: guided upload - validate, review mapping, preview, explicit confirm import.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { api, ApiError, type ValidateResult } from '../../services/api';

const FIELD_LABELS: Record<string, string> = {
  transaction_id_or_utr: 'Transaction ID / UTR',
  transaction_datetime: 'Transaction date/time',
  amount_lost: 'Amount',
  debit_bank_wallet_merchant: 'Debit bank/wallet/merchant',
  debit_account_wallet_upi_id: 'Debit account/wallet/UPI',
  credit_bank_wallet_merchant: 'Credit bank/wallet/merchant',
  credit_account_wallet_upi_id: 'Credit account/wallet/UPI',
  complaint_acknowledgement_id: 'Complaint/acknowledgement ID',
  merchant_gateway_details: 'Merchant/gateway details',
};

export default function UploadWizard() {
  const [file, setFile] = React.useState<File | null>(null);
  const [v, setV] = React.useState<ValidateResult | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [sourceType, setSourceType] = React.useState<'current' | 'historical'>('current');
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ accepted: number; rejected: number; duplicates: number } | null>(null);
  const nav = useNavigate();

  const pick = async (f: File) => {
    setFile(f); setErr(null); setV(null); setDone(null);
    setName(f.name.replace(/\.csv$/i, ''));
    setBusy(true);
    try {
      const r = await api.validate(f);
      setV(r);
      setMapping(r.suggested_mapping ?? {});
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Validation failed.');
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.importDataset(file, {
        file_name: file.name, mapping, source_type: sourceType, name: name || file.name, currency: 'INR',
      });
      setDone({ accepted: r.accepted, rejected: r.rejected, duplicates: r.duplicates });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Import failed.');
    } finally { setBusy(false); }
  };

  if (done) return (
    <div className="card p-6 max-w-xl">
      <CheckCircle2 size={22} className="mb-2" style={{ color: 'var(--color-risk-low)' }} />
      <div className="text-[15px] font-bold mb-2">Import complete</div>
      <div className="text-[13px] grid gap-1 mb-4">
        <span>Accepted rows: <b className="num">{done.accepted}</b></span>
        <span>Rejected rows: <b className="num">{done.rejected}</b></span>
        <span>Duplicates flagged (not deleted): <b className="num">{done.duplicates}</b></span>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => nav('/platform')}>Back to workspace</button>
        {sourceType === 'current' && <button className="btn" onClick={() => nav('/platform')}>Analyse dataset</button>}
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 max-w-3xl">
      <div className="card p-5">
        <div className="text-[15px] font-bold mb-1">Insert Specific Dataset</div>
        <div className="text-[12.5px] text-ink-mute mb-4">
          CSV only in this phase. Validation runs first; nothing is stored until you confirm.
          Missing recipient columns limit money-trail depth - they are never invented.
        </div>
        <label className="btn !py-6 w-full justify-center border-dashed cursor-pointer">
          <FileUp size={16} /> {file ? file.name : 'Choose a CSV file'}
          <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        </label>
        {busy && <div className="state-box">Validating…</div>}
        {err && <div className="err-text mt-3"><XCircle size={13} className="inline mr-1" />{err}</div>}
      </div>

      {v && (
        <div className="card p-5 grid gap-4">
          <div>
            <div className="text-[13px] font-bold mb-1.5">Validation</div>
            <div className="grid gap-1">
              {v.issues.map((i, k) => (
                <div key={k} className={i.level === 'error' ? 'err-text' : 'warn-text'}>
                  {i.level === 'error' ? 'Error' : 'Warning'}: {i.message}
                </div>
              ))}
              {v.issues.length === 0 && <div className="text-[12.5px]" style={{ color: 'var(--color-risk-low)' }}>No issues found in the sampled rows.</div>}
            </div>
            <div className="text-[12px] text-ink-mute mt-2 num">
              {v.row_count ?? 0} data rows; checksum {v.checksum.slice(0, 16)}…
              {(v.sample_invalid ?? 0) > 0 && `; ${v.sample_invalid} invalid in preview sample`}
            </div>
          </div>

          <div>
            <div className="text-[13px] font-bold mb-1.5">Column mapping - review before import</div>
            <div className="grid gap-1.5">
              {Object.keys(FIELD_LABELS).map((field) => (
                <div key={field} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-56 text-ink-soft">{FIELD_LABELS[field]}</span>
                  <select className="btn !py-1 !text-[12px] flex-1" value={mapping[field] ?? ''}
                    onChange={(e) => setMapping((m) => { const n = { ...m }; if (e.target.value) n[field] = e.target.value; else delete n[field]; return n; })}>
                    <option value="">- not present -</option>
                    {(v.headers ?? []).map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {v.sample && v.sample.length > 0 && (
            <div>
              <div className="text-[13px] font-bold mb-1.5">Preview (first rows)</div>
              <div className="table-scroll"><table className="table-base">
                <thead><tr><th>Row</th>{(v.headers ?? []).slice(0, 6).map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{v.sample.map((s) => (
                  <tr key={s.row} className={s.ok ? '' : 'opacity-60'}>
                    <td className="num">{s.row}</td>
                    {(v.headers ?? []).slice(0, 6).map((h) => <td key={h} className="text-[12px]">{s.values[h]}</td>)}
                  </tr>))}
                </tbody>
              </table></div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[12.5px] flex items-center gap-2">Dataset name
              <input className="btn !py-1 !text-[12px]" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="text-[12.5px] flex items-center gap-2">Type
              <select className="btn !py-1 !text-[12px]" value={sourceType} onChange={(e) => setSourceType(e.target.value as any)}>
                <option value="current">Current investigation data</option>
                <option value="historical">Historical training data (trusted labels only)</option>
              </select>
            </label>
            <span className="text-[11.5px] text-ink-mute">Currency: INR (dataset-level)</span>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={!v.valid || busy} onClick={confirm}>
              {busy ? 'Importing…' : 'Confirm import'}
            </button>
            {!v.valid && <span className="err-text self-center">Fix the errors above before importing.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
