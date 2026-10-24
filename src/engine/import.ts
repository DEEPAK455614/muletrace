// Dataset import: parse user-uploaded CSV/JSON into a World the existing
// engine can analyse. Everything runs locally in the browser - uploaded data
// never leaves the device (no API calls, no storage of row content beyond the
// active session). Uploaded data is UNVERIFIED: the UI must badge it as such
// and never present it as validated banking data.
import type { World, Account, Txn, Complaint, Channel, Customer } from './types';

export interface ColumnMapping {
  [canonical: string]: string; // canonical field -> uploaded header
}

export interface ImportIssue {
  level: 'error' | 'warning';
  message: string;
}

export interface ImportResult {
  world: World | null;
  issues: ImportIssue[];
  stats: { accounts: number; txns: number; complaints: number; derivedAccounts: number; skippedRows: number };
}

// --- minimal CSV parser (quoted fields, escaped quotes, LF/CRLF) ---
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

// Canonical fields and the header synonyms we auto-map (lowercase compare).
export const TXN_FIELDS: Record<string, { required: boolean; synonyms: string[] }> = {
  id: { required: false, synonyms: ['id', 'txn id', 'transaction id', 'txn_id', 'transaction_id', 'ref', 'utr'] },
  from: { required: true, synonyms: ['from', 'from account', 'from_account', 'sender', 'payer', 'debit account', 'debited account', 'remitter'] },
  to: { required: true, synonyms: ['to', 'to account', 'to_account', 'receiver', 'payee', 'beneficiary', 'credit account', 'credited account'] },
  amount: { required: true, synonyms: ['amount', 'amt', 'value', 'transaction amount', 'amount inr', 'inr'] },
  ts: { required: true, synonyms: ['ts', 'timestamp', 'date', 'datetime', 'txn date', 'transaction date', 'time', 'value date'] },
  channel: { required: false, synonyms: ['channel', 'mode', 'payment mode', 'txn type', 'type'] },
};

export const ACCOUNT_FIELDS: Record<string, { required: boolean; synonyms: string[] }> = {
  id: { required: true, synonyms: ['id', 'account', 'account id', 'account_id', 'account number', 'account_number', 'acc no'] },
  customerId: { required: false, synonyms: ['customer id', 'customer_id', 'customer', 'cust id'] },
  bank: { required: false, synonyms: ['bank', 'bank name'] },
  ifsc: { required: false, synonyms: ['ifsc', 'ifsc code'] },
  type: { required: false, synonyms: ['type', 'account type', 'acc type'] },
  openedAt: { required: false, synonyms: ['opened at', 'opened_at', 'open date', 'opening date', 'created at'] },
  city: { required: false, synonyms: ['city', 'branch city'] },
  phone: { required: false, synonyms: ['phone', 'mobile', 'phone number', 'mobile number'] },
};

export const COMPLAINT_FIELDS: Record<string, { required: boolean; synonyms: string[] }> = {
  id: { required: false, synonyms: ['id', 'ref', 'reference', 'complaint id', 'ack no', 'acknowledgement'] },
  category: { required: false, synonyms: ['category', 'type', 'crime type', 'fraud type'] },
  reportedAt: { required: false, synonyms: ['reported at', 'reported_at', 'report date', 'date'] },
  amountLost: { required: false, synonyms: ['amount lost', 'amount_lost', 'loss', 'loss amount'] },
  victimAccountId: { required: false, synonyms: ['victim account', 'victim_account_id', 'complainant account'] },
  namedAccountIds: { required: true, synonyms: ['named accounts', 'named_account_ids', 'suspect account', 'suspect accounts', 'beneficiary account', 'mule account'] },
  city: { required: false, synonyms: ['city'] },
  state: { required: false, synonyms: ['state'] },
  summary: { required: false, synonyms: ['summary', 'description', 'details'] },
};

const norm = (h: string) => h.trim().toLowerCase().replace(/[.\-_/]+/g, ' ').replace(/\s+/g, ' ');

export function autoMap(headers: string[], spec: Record<string, { required: boolean; synonyms: string[] }>): ColumnMapping {
  const map: ColumnMapping = {};
  const normed = headers.map((h) => norm(h));
  for (const [field, { synonyms }] of Object.entries(spec)) {
    const idx = normed.findIndex((h) => synonyms.includes(h));
    if (idx >= 0) map[field] = headers[idx];
  }
  return map;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, '').replace(/rs\.?/i, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseTs(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{10,13}$/.test(t)) {
    const n = Number(t);
    return t.length === 10 ? n * 1000 : n;
  }
  // DD/MM/YYYY or DD-MM-YYYY (optional time)
  const dm = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dm) {
    const [, d, m, y, hh = '0', mm = '0', ss = '0'] = dm;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const ms = Date.UTC(year, Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = Date.parse(t);
  return Number.isFinite(parsed) ? parsed : null;
}

const CHANNELS: Channel[] = ['UPI', 'IMPS', 'NEFT', 'RTGS', 'ATM'];
function parseChannel(raw: string): Channel {
  const up = raw.trim().toUpperCase();
  return (CHANNELS as string[]).includes(up) ? (up as Channel) : 'UPI';
}

export function buildWorld(
  txnRows: string[][], txnMap: ColumnMapping,
  accountRows: string[][] | null, accountMap: ColumnMapping | null,
  complaintRows: string[][] | null, complaintMap: ColumnMapping | null,
): ImportResult {
  const issues: ImportIssue[] = [];
  let skippedRows = 0;

  const col = (row: string[], headers: string[], field: string, map: ColumnMapping): string => {
    const h = map[field];
    if (!h) return '';
    const idx = headers.indexOf(h);
    return idx >= 0 ? (row[idx] ?? '').trim() : '';
  };

  const txnHeaders = txnRows[0] ?? [];
  for (const f of ['from', 'to', 'amount', 'ts']) {
    if (!txnMap[f]) issues.push({ level: 'error', message: `Transactions: required field "${f}" is not mapped to a column.` });
  }
  if (issues.some((i) => i.level === 'error')) return { world: null, issues, stats: { accounts: 0, txns: 0, complaints: 0, derivedAccounts: 0, skippedRows: 0 } };

  const txns: Txn[] = [];
  const endpointIds = new Set<string>();
  txnRows.slice(1).forEach((row, i) => {
    const from = col(row, txnHeaders, 'from', txnMap);
    const to = col(row, txnHeaders, 'to', txnMap);
    const amount = parseAmount(col(row, txnHeaders, 'amount', txnMap));
    const ts = parseTs(col(row, txnHeaders, 'ts', txnMap));
    if (!from || !to || amount === null || amount === 0 || ts === null) { skippedRows++; return; }
    txns.push({
      id: col(row, txnHeaders, 'id', txnMap) || `T${i + 1}`,
      from, to, amount, ts,
      channel: parseChannel(col(row, txnHeaders, 'channel', txnMap) || 'UPI'),
    });
    endpointIds.add(from); endpointIds.add(to);
  });
  if (!txns.length) issues.push({ level: 'error', message: 'No valid transaction rows after parsing (check column mapping, amounts and dates).' });

  const accounts: Account[] = [];
  const customers: Customer[] = [];
  const seen = new Set<string>();
  if (accountRows && accountMap) {
    const ah = accountRows[0] ?? [];
    if (!accountMap.id) issues.push({ level: 'error', message: 'Accounts: required field "id" is not mapped.' });
    else {
      accountRows.slice(1).forEach((row) => {
        const id = col(row, ah, 'id', accountMap);
        if (!id || seen.has(id)) return;
        seen.add(id);
        const openedRaw = col(row, ah, 'openedAt', accountMap);
        accounts.push({
          id,
          customerId: col(row, ah, 'customerId', accountMap) || `C-${id}`,
          bank: col(row, ah, 'bank', accountMap) || 'Unspecified',
          ifsc: col(row, ah, 'ifsc', accountMap) || 'N/A',
          type: /current/i.test(col(row, ah, 'type', accountMap)) ? 'current' : 'savings',
          openedAt: parseTs(openedRaw) ?? Date.now(),
          city: col(row, ah, 'city', accountMap) || 'Unspecified',
          pin: '000000',
          deviceId: `D-${id}`,
          phone: col(row, ah, 'phone', accountMap) || 'N/A',
          addressId: `A-${id}`,
        });
      });
    }
  }

  // Derive stub accounts for transaction endpoints not present in the accounts file.
  let derivedAccounts = 0;
  for (const id of endpointIds) {
    if (seen.has(id) || id === 'EXT' || id === 'ATM') continue;
    seen.add(id);
    derivedAccounts++;
    accounts.push({
      id, customerId: `C-${id}`, bank: 'Derived from transactions', ifsc: 'N/A', type: 'savings',
      openedAt: Date.now(), city: 'Unspecified', pin: '000000', deviceId: `D-${id}`, phone: 'N/A', addressId: `A-${id}`,
    });
  }
  if (derivedAccounts > 0) issues.push({ level: 'warning', message: `${derivedAccounts} account(s) were seen only as transaction endpoints and were added with placeholder attributes.` });

  const accountIds = new Set(accounts.map((a) => a.id));
  const seenCust = new Set<string>();
  for (const a of accounts) {
    if (seenCust.has(a.customerId)) continue;
    seenCust.add(a.customerId);
    customers.push({ id: a.customerId, name: `Customer ${a.customerId}`, ageBand: 'Unknown', occupation: 'Unknown', city: a.city, declaredIncome: 0 });
  }

  const complaints: Complaint[] = [];
  if (complaintRows && complaintMap) {
    const ch = complaintRows[0] ?? [];
    if (!complaintMap.namedAccountIds) issues.push({ level: 'warning', message: 'Complaints: "named accounts" not mapped - complaint correlation will be empty.' });
    else {
      complaintRows.slice(1).forEach((row, i) => {
        const namedRaw = col(row, ch, 'namedAccountIds', complaintMap);
        const named = namedRaw.split(/[;|\s]+/).map((x) => x.trim()).filter((x) => x && accountIds.has(x));
        if (!named.length) return;
        complaints.push({
          id: col(row, ch, 'id', complaintMap) || `C${i + 1}`,
          ref: col(row, ch, 'id', complaintMap) || `CMP-${i + 1}`,
          category: col(row, ch, 'category', complaintMap) || 'Cyber fraud',
          reportedAt: parseTs(col(row, ch, 'reportedAt', complaintMap)) ?? Date.now(),
          amountLost: parseAmount(col(row, ch, 'amountLost', complaintMap)) ?? 0,
          victimAccountId: col(row, ch, 'victimAccountId', complaintMap) || 'EXT',
          namedAccountIds: named,
          city: col(row, ch, 'city', complaintMap) || 'Unspecified',
          state: col(row, ch, 'state', complaintMap) || 'Unspecified',
          summary: col(row, ch, 'summary', complaintMap) || '',
        });
      });
    }
  }

  if (issues.some((i) => i.level === 'error')) return { world: null, issues, stats: { accounts: accounts.length, txns: txns.length, complaints: complaints.length, derivedAccounts, skippedRows } };

  const tss = txns.map((t) => t.ts);
  const world: World = {
    seed: 'uploaded',
    generatedAt: Date.now(),
    windowStart: Math.min(...tss),
    windowEnd: Math.max(...tss),
    customers, accounts, txns, complaints,
    groundTruth: {}, // uploaded data has no labels - Evaluation stays on the synthetic benchmark
    hardNegatives: {},
    scenarioNotes: [],
  };
  return { world, issues, stats: { accounts: accounts.length, txns: txns.length, complaints: complaints.length, derivedAccounts, skippedRows } };
}
