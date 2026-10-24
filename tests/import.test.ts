import { describe, it, expect } from 'vitest';
import { parseCsv, autoMap, buildWorld, TXN_FIELDS, ACCOUNT_FIELDS, COMPLAINT_FIELDS } from '../src/engine/import';
import { analyzeWorld } from '../src/engine';

const TXN_CSV = `id,from_account,to_account,amount,txn date,channel
T1,A1,A2,"45,000",12/03/2026 10:15,UPI
T2,A2,A3,44900,12/03/2026 11:02,IMPS
T3,A3,ATM,40000,12/03/2026 18:40,ATM
T4,EXT,A1,45000,12/03/2026 09:00,NEFT
bad-row,,,,
T5,A1,A2,abc,12/03/2026,UPI`;

const ACCT_CSV = `account id,bank,ifsc,account type,city
A1,HDFC,HDFC0001,savings,Patna
A2,SBI,SBIN0002,savings,Gaya`;

const CMP_CSV = `ref,category,loss amount,named accounts
CMP1,UPI fraud,45000,A2
CMP2,Job scam,30000,A9`;

describe('csv parser', () => {
  it('handles quoted commas and skips empty rows', () => {
    const rows = parseCsv('a,b\n"1,000",x\n\n2,y\n');
    expect(rows).toEqual([['a', 'b'], ['1,000', 'x'], ['2', 'y']]);
  });
});

describe('auto mapping', () => {
  it('maps common synonyms case-insensitively', () => {
    const map = autoMap(['ID', 'From_Account', 'To Account', 'Amount INR', 'Txn Date'], TXN_FIELDS);
    expect(map.from).toBe('From_Account');
    expect(map.to).toBe('To Account');
    expect(map.amount).toBe('Amount INR');
    expect(map.ts).toBe('Txn Date');
    expect(map.id).toBe('ID');
  });
});

describe('buildWorld', () => {
  const txnRows = parseCsv(TXN_CSV);
  const txnMap = autoMap(txnRows[0], TXN_FIELDS);
  const acctRows = parseCsv(ACCT_CSV);
  const acctMap = autoMap(acctRows[0], ACCOUNT_FIELDS);
  const cmpRows = parseCsv(CMP_CSV);
  const cmpMap = autoMap(cmpRows[0], COMPLAINT_FIELDS);

  it('builds a world with derived endpoint accounts and skips invalid rows', () => {
    const r = buildWorld(txnRows, txnMap, acctRows, acctMap, cmpRows, cmpMap);
    expect(r.world).not.toBeNull();
    expect(r.stats.txns).toBe(4); // bad-row + non-numeric amount skipped
    expect(r.stats.skippedRows).toBe(2);
    expect(r.stats.accounts).toBe(3); // A1, A2 from file; A3 derived
    expect(r.stats.derivedAccounts).toBe(1);
    expect(r.world!.complaints.length).toBe(1); // CMP2 names unknown A9 - dropped
    expect(Object.keys(r.world!.groundTruth).length).toBe(0);
  });

  it('errors when required transaction fields are unmapped', () => {
    const r = buildWorld(txnRows, { from: 'from_account' }, null, null, null, null);
    expect(r.world).toBeNull();
    expect(r.issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('runs the full engine on the uploaded world', () => {
    const r = buildWorld(txnRows, txnMap, acctRows, acctMap, cmpRows, cmpMap);
    const a = analyzeWorld(r.world!);
    expect(a.scores.size).toBe(3);
    expect(a.evaluation.positives).toBe(0);
    expect(a.buildMs).toBeGreaterThanOrEqual(0);
  });
});
