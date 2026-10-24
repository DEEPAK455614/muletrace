// Deterministic synthetic dataset generator.
// Builds a realistic ~430-account retail banking universe over Jan-Oct 2026 with
// five injected fraud scenarios grounded in published mule typologies.
// Every run with the same seed produces byte-identical output.
import { makeRng, pick, range, rangeInt, chance, type Rng } from './rng';
import { FIRST_NAMES, LAST_NAMES, BANKS, CITIES, OCCUPATIONS, AGE_BANDS, COMPLAINT_CATEGORIES } from './data-pools';
import type { World, Customer, Account, Txn, Complaint, GroundTruth, Channel } from './types';

export const DAY = 86400000;
export const HOUR = 3600000;
export const MIN = 60000;
export const WINDOW_START = Date.UTC(2026, 0, 5); // 5 Jan 2026
export const WINDOW_END = Date.UTC(2026, 9, 15); // 15 Oct 2026

interface Builder {
  customers: Customer[];
  accounts: Account[];
  txns: Txn[];
  complaints: Complaint[];
  groundTruth: Record<string, GroundTruth>;
  hardNegatives: Record<string, string>;
}

function inr(rng: Rng, min: number, max: number): number {
  return Math.round(range(rng, min, max) / 10) * 10;
}

export function generateWorld(seed = 'muletrace-v1'): World {
  const rng = makeRng(seed);
  const b: Builder = { customers: [], accounts: [], txns: [], complaints: [], groundTruth: {}, hardNegatives: {} };
  let custN = 1000, accN = 1000, txnN = 100000, cmpN = 100;
  const usedNames = new Set<string>();
  const usedDevices = new Set<string>();
  const usedPhones = new Set<string>();

  const mkName = (): string => {
    for (;;) {
      const n = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
      if (!usedNames.has(n)) { usedNames.add(n); return n; }
    }
  };
  const mkDevice = (): string => {
    for (;;) {
      const d = `DEV-${rangeInt(rng, 10000, 99999)}`;
      if (!usedDevices.has(d)) { usedDevices.add(d); return d; }
    }
  };
  const mkPhone = (): string => {
    for (;;) {
      const p = `+91 ${rangeInt(rng, 70000, 99999)}${rangeInt(rng, 10000, 99999)}`;
      if (!usedPhones.has(p)) { usedPhones.add(p); return p; }
    }
  };

  const addCustomer = (over: Partial<Customer> = {}): Customer => {
    const c: Customer = {
      id: `C${++custN}`,
      name: mkName(),
      ageBand: pick(rng, AGE_BANDS),
      occupation: pick(rng, OCCUPATIONS),
      city: pick(rng, CITIES).city,
      declaredIncome: inr(rng, 180000, 1800000),
      ...over,
    };
    b.customers.push(c);
    return c;
  };

  const addAccount = (customer: Customer, over: Partial<Account> = {}): Account => {
    const bank = pick(rng, BANKS);
    const cityObj = CITIES.find((c) => c.city === (over.city ?? customer.city)) ?? pick(rng, CITIES);
    const a: Account = {
      id: `A${++accN}`,
      customerId: customer.id,
      bank: bank.name,
      ifsc: `${bank.ifscPrefix}0${rangeInt(rng, 100000, 999999)}`,
      type: chance(rng, 0.85) ? 'savings' : 'current',
      openedAt: WINDOW_START - rangeInt(rng, 30, 2600) * DAY,
      city: cityObj.city,
      pin: cityObj.pin,
      deviceId: mkDevice(),
      phone: mkPhone(),
      addressId: `ADDR-${cityObj.pin}-${rangeInt(rng, 100, 999)}`,
      ...over,
    };
    b.accounts.push(a);
    return a;
  };

  const txn = (from: string, to: string, amount: number, ts: number, channel: Channel): Txn => {
    const t: Txn = { id: `T${++txnN}`, from, to, amount: Math.round(amount), ts: Math.round(ts), channel };
    b.txns.push(t);
    return t;
  };

  const addComplaint = (c: Omit<Complaint, 'id' | 'ref'>): Complaint => {
    const d = new Date(c.reportedAt);
    const cmp: Complaint = {
      ...c,
      id: `CMP${++cmpN}`,
      ref: `NCRP-2026-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${rangeInt(rng, 100000, 999999)}`,
    };
    b.complaints.push(cmp);
    return cmp;
  };

  const gt = (account: Account, role: GroundTruth['role'], ring: string, note: string) => {
    b.groundTruth[account.id] = { role, ring, note };
  };
  const hn = (account: Account, note: string) => {
    b.hardNegatives[account.id] = note;
  };

  // ---------- pools ----------
  const employers: Account[] = [];
  const merchants: Account[] = [];
  const landlords: Account[] = [];
  const normals: Account[] = [];

  for (let i = 0; i < 15; i++) {
    const c = addCustomer({ name: `${pick(rng, ['Shree', 'Om', 'Sai', 'Jai', 'New', 'Star', 'Royal', 'City', 'Prime', 'United'])} ${pick(rng, ['Enterprises', 'Industries', 'Traders', 'Infotech', 'Textiles', 'Logistics', 'Foods', 'Motors', 'Electronics', 'Builders'])} ${pick(rng, ['Pvt Ltd', 'LLP', '& Sons'])}`, occupation: 'Small business owner', declaredIncome: inr(rng, 2500000, 9000000) });
    employers.push(addAccount(c, { type: 'current' }));
  }
  for (let i = 0; i < 40; i++) {
    const c = addCustomer({ name: `${mkName().split(' ')[1]} ${pick(rng, ['Kirana Store', 'Medical Store', 'Cafe', 'Bakery', 'Mobile Shop', 'Garments', 'Hardware', 'Salon', 'Sweet House', 'Book Depot'])}`, occupation: 'Small business owner', declaredIncome: inr(rng, 600000, 3000000) });
    merchants.push(addAccount(c, { type: 'current' }));
  }
  for (let i = 0; i < 12; i++) {
    landlords.push(addAccount(addCustomer()));
  }
  for (let i = 0; i < 340; i++) {
    normals.push(addAccount(addCustomer()));
  }
  const allNormals = [...employers, ...merchants, ...landlords, ...normals];

  // ---------- normal behaviour ----------
  const monthStarts: number[] = [];
  for (let m = 0; m < 10; m++) monthStarts.push(Date.UTC(2026, m, 1));

  for (const emp of employers) {
    const staff = normals.filter(() => chance(rng, 0.045)).slice(0, rangeInt(rng, 8, 20));
    for (const s of staff) {
      const salary = inr(rng, 32000, 145000);
      for (const ms of monthStarts) {
        if (ms + rangeInt(rng, 0, 2) * DAY >= WINDOW_END) continue;
        txn(emp.id, s.id, salary, ms + rangeInt(rng, 0, 2) * DAY + rangeInt(rng, 9, 18) * HOUR, 'NEFT');
      }
      (s as Account & { __salary?: number }).__salary = salary;
    }
  }

  for (const a of normals) {
    const profile = chance(rng, 0.6) ? 'spender' : chance(rng, 0.5) ? 'light' : 'active';
    const baseMonthly = profile === 'active' ? rangeInt(rng, 8, 14) : profile === 'spender' ? rangeInt(rng, 4, 8) : rangeInt(rng, 2, 4);
    // spends to merchants
    for (let m = 0; m < 9; m++) {
      const mStart = Date.UTC(2026, m, rangeInt(rng, 2, 26));
      for (let k = 0; k < baseMonthly; k++) {
        const ts = mStart + rangeInt(rng, 0, 27) * DAY + rangeInt(rng, 8, 22) * HOUR;
        if (ts > WINDOW_END) continue;
        txn(a.id, pick(rng, merchants).id, inr(rng, 90, 2600), ts, 'UPI');
      }
      if (chance(rng, 0.5)) {
        const ts = mStart + rangeInt(rng, 0, 25) * DAY + rangeInt(rng, 9, 21) * HOUR;
        if (ts <= WINDOW_END) txn(a.id, pick(rng, landlords).id, inr(rng, 7000, 26000), ts, 'UPI');
      }
      // P2P
      if (chance(rng, 0.45)) {
        const other = pick(rng, normals);
        if (other.id !== a.id) {
          const ts = mStart + rangeInt(rng, 0, 25) * DAY + rangeInt(rng, 9, 21) * HOUR;
          if (ts <= WINDOW_END) txn(a.id, other.id, inr(rng, 500, 9000), ts, 'UPI');
        }
      }
      if (chance(rng, 0.25)) {
        const ts = mStart + rangeInt(rng, 0, 25) * DAY + rangeInt(rng, 10, 20) * HOUR;
        if (ts <= WINDOW_END) txn(a.id, 'ATM', inr(rng, 2000, 12000), ts, 'ATM');
      }
    }
    // rare same-day forward (noise for pass-through factor)
    if (chance(rng, 0.06)) {
      const t1 = WINDOW_START + rangeInt(rng, 40, 240) * DAY + 10 * HOUR;
      const amt = inr(rng, 15000, 60000);
      const other = pick(rng, normals);
      txn(pick(rng, allNormals).id, a.id, amt, t1, 'UPI');
      txn(a.id, other.id, amt * range(rng, 0.9, 1), t1 + range(rng, 1, 9) * HOUR, 'UPI');
    }
  }

  // merchant inflows from population
  for (const m of merchants) {
    const payers = rangeInt(rng, 25, 60);
    for (let i = 0; i < payers; i++) {
      const ts = WINDOW_START + rangeInt(rng, 0, 270) * DAY + rangeInt(rng, 8, 22) * HOUR;
      if (ts > WINDOW_END) continue;
      txn(pick(rng, normals).id, m.id, inr(rng, 100, 3000), ts, 'UPI');
    }
    // supplier payouts monthly
    for (let mo = 0; mo < 9; mo++) {
      const ts = Date.UTC(2026, mo, rangeInt(rng, 3, 26)) + rangeInt(rng, 9, 18) * HOUR;
      if (ts > WINDOW_END) continue;
      txn(m.id, pick(rng, employers).id, inr(rng, 15000, 90000), ts, 'NEFT');
    }
  }

  // one legitimate family device share (noise for shared-device factor)
  if (normals.length > 30) {
    const famDev = mkDevice();
    normals[20].deviceId = famDev;
    normals[21].deviceId = famDev;
    normals[20].addressId = normals[21].addressId;
  }

  // ---------- victim helper ----------
  const mkVictim = (): Account => {
    const v = addAccount(addCustomer());
    // modest normal history so the account itself looks genuine
    for (let i = 0; i < rangeInt(rng, 6, 14); i++) {
      const ts = WINDOW_START + rangeInt(rng, 0, 250) * DAY + rangeInt(rng, 8, 21) * HOUR;
      txn(v.id, pick(rng, merchants).id, inr(rng, 150, 2400), ts, 'UPI');
    }
    txn(pick(rng, employers).id, v.id, inr(rng, 30000, 85000), WINDOW_START + rangeInt(rng, 10, 60) * DAY, 'NEFT');
    return v;
  };

  const scenarioNotes: World['scenarioNotes'] = [];

  // ---------- Scenario P: fan-in pass-through mule ring ----------
  {
    const ring = 'ring-passthrough';
    const herder = addAccount(addCustomer());
    const collector = addAccount(addCustomer(), { type: 'current' });
    const offramp = addAccount(addCustomer({ name: 'Galaxy Forex Pvt Ltd', occupation: 'Small business owner', declaredIncome: 4200000 }), { type: 'current' });
    const herdDevice = mkDevice();
    const mules: Account[] = [];
    for (let i = 0; i < 8; i++) {
      const m = addAccount(addCustomer({ ageBand: pick(rng, ['18-24', '25-34']), declaredIncome: inr(rng, 150000, 420000) }), {
        openedAt: WINDOW_START + rangeInt(rng, 120, 165) * DAY,
        deviceId: i < 5 ? herdDevice : mkDevice(),
      });
      mules.push(m);
    }
    gt(herder, 'herder', ring, 'Recruiter/controller; shares device with five ring accounts');
    gt(collector, 'collector', ring, 'Aggregation point; rapid cash-out and off-ramp transfers');
    gt(offramp, 'offramp', ring, 'Merchant front used to move funds out of the banking rail');
    mules.forEach((m, i) => gt(m, 'mule-pass', ring, `Pass-through mule #${i + 1}`));

    const victims: Account[] = [];
    for (let i = 0; i < 12; i++) victims.push(mkVictim());
    const ringStart = Date.UTC(2026, 5, 12); // mid-June
    victims.forEach((v, vi) => {
      const mule = mules[vi % mules.length];
      const lost = inr(rng, 24000, 165000);
      const t1 = ringStart + rangeInt(rng, 0, 45) * DAY + rangeInt(rng, 9, 21) * HOUR;
      txn(v.id, mule.id, lost, t1, 'UPI');
      if (chance(rng, 0.35)) txn(v.id, mule.id, inr(rng, 4000, 18000), t1 + range(rng, 2, 30) * HOUR, 'UPI');
      // mule forwards to collector within minutes-hours, keeping a small cut
      const fwd = lost * range(rng, 0.86, 0.97);
      const t2 = t1 + range(rng, 8, 320) * MIN;
      if (chance(rng, 0.7)) {
        txn(mule.id, collector.id, fwd * range(rng, 0.55, 0.7), t2, 'IMPS');
        txn(mule.id, collector.id, fwd * range(rng, 0.28, 0.42), t2 + range(rng, 10, 90) * MIN, 'IMPS');
      } else {
        txn(mule.id, collector.id, fwd, t2, 'IMPS');
      }
      if (chance(rng, 0.45)) txn(mule.id, herder.id, fwd * range(rng, 0.02, 0.035), t2 + range(rng, 1, 8) * HOUR, 'UPI');
      // complaint for ~half the victims
      if (vi % 2 === 0) {
        addComplaint({
          category: pick(rng, COMPLAINT_CATEGORIES.slice(0, 6)),
          reportedAt: t1 + rangeInt(rng, 1, 8) * DAY,
          amountLost: lost,
          victimAccountId: v.id,
          namedAccountIds: [mule.id],
          city: pick(rng, CITIES).city,
          state: 'Uttar Pradesh',
          summary: `Victim reports being defrauded and transferring funds to beneficiary account ending ${mule.id.slice(-4)}.`,
        });
      }
    });
    // collector cash-out + off-ramp
    for (let i = 0; i < 9; i++) {
      txn(collector.id, 'ATM', inr(rng, 40000, 100000), ringStart + rangeInt(rng, 3, 60) * DAY + rangeInt(rng, 10, 22) * HOUR, 'ATM');
    }
    for (let i = 0; i < 5; i++) {
      txn(collector.id, offramp.id, inr(rng, 90000, 240000), ringStart + rangeInt(rng, 5, 58) * DAY + 14 * HOUR, 'IMPS');
    }
    scenarioNotes.push({ ring, title: 'Pass-through mule ring', description: 'Victim funds land in eight mule accounts and are forwarded to one collector within minutes to hours, then cashed out at ATMs and pushed to a merchant off-ramp. Five mules share one device (herder-controlled).', size: 11 });
  }

  // ---------- Scenario L: layering chain ----------
  {
    const ring = 'ring-layering';
    const chain: Account[] = [];
    const sharedAddr = `ADDR-560001-777`;
    for (let i = 0; i < 5; i++) {
      chain.push(addAccount(addCustomer({ declaredIncome: inr(rng, 200000, 550000) }), {
        openedAt: WINDOW_START + rangeInt(rng, 150, 200) * DAY,
        addressId: i === 1 || i === 3 ? sharedAddr : `ADDR-${pick(rng, CITIES).pin}-${rangeInt(rng, 100, 999)}`,
      }));
      gt(chain[i], 'mule-layer', ring, `Layering hop #${i + 1}`);
    }
    const offramp = addAccount(addCustomer({ name: 'QuickExch Digital Services Pvt Ltd', occupation: 'Small business owner', declaredIncome: 5000000 }), { type: 'current' });
    gt(offramp, 'offramp', ring, 'Foreign remittance off-ramp');
    const victim = mkVictim();
    const victim2 = mkVictim();
    const base = Date.UTC(2026, 7, 3) + 11 * HOUR;
    [315000, 322000, 318000].forEach((amt, i) => {
      const t = base + i * rangeInt(rng, 40, 60) * HOUR;
      let prev = victim.id; let prevAmt = amt; let prevTs = t;
      txn(victim.id, chain[0].id, amt, t, 'IMPS');
      for (let h = 0; h < chain.length - 1; h++) {
        const nextAmt = prevAmt * range(rng, 0.9, 0.96);
        const nextTs = prevTs + range(rng, 3, 17) * HOUR;
        txn(chain[h].id, chain[h + 1].id, nextAmt, nextTs, h % 2 ? 'NEFT' : 'IMPS');
        prevAmt = nextAmt; prevTs = nextTs;
      }
      txn(chain[4].id, offramp.id, prevAmt * range(rng, 0.86, 0.92), prevTs + range(rng, 6, 20) * HOUR, 'NEFT');
    });
    txn(victim2.id, chain[0].id, 46000, base + 9 * DAY, 'UPI');
    txn(chain[4].id, 'ATM', 80000, base + 12 * DAY, 'ATM');
    addComplaint({
      category: 'Investment scam', reportedAt: base + 6 * DAY, amountLost: 955000,
      victimAccountId: victim.id, namedAccountIds: [chain[0].id],
      city: 'Bengaluru', state: 'Karnataka',
      summary: 'Victim lured into a fake trading platform; transferred Rs 9.55 lakh in three tranches to the named beneficiary.',
    });
    addComplaint({
      category: 'Fake job offer', reportedAt: base + 12 * DAY, amountLost: 46000,
      victimAccountId: victim2.id, namedAccountIds: [chain[0].id],
      city: 'Pune', state: 'Maharashtra',
      summary: 'Victim paid a refundable security deposit for a fake work-from-home offer.',
    });
    scenarioNotes.push({ ring, title: 'Layering chain', description: 'A single large victim loss is walked through five accounts over 3-17 hours per hop, losing 4-10% each hop, exiting via a remittance off-ramp. Two hops share a registered address.', size: 6 });
  }

  // ---------- Scenario S: structured deposits (smurfing) ----------
  {
    const ring = 'ring-structuring';
    const front = addAccount(addCustomer({ name: 'Shree Balaji Trading Co', occupation: 'Small business owner', declaredIncome: 2600000 }), { type: 'current' });
    const recruits: Account[] = [];
    for (let i = 0; i < 5; i++) {
      const s = addAccount(addCustomer({ ageBand: pick(rng, ['18-24', '25-34']), declaredIncome: inr(rng, 120000, 360000) }), { openedAt: WINDOW_START + rangeInt(rng, 60, 110) * DAY });
      recruits.push(s);
      gt(s, 'mule-struct', ring, `Structured-deposit collector #${i + 1}`);
    }
    gt(front, 'collector', ring, 'Business front aggregating structured deposits');
    const sStart = Date.UTC(2026, 4, 6);
    recruits.forEach((s, si) => {
      const deposits = rangeInt(rng, 10, 15);
      for (let i = 0; i < deposits; i++) {
        const t = sStart + rangeInt(rng, 0, 42) * DAY + rangeInt(rng, 9, 21) * HOUR;
        txn(pick(rng, normals).id, s.id, inr(rng, 4200, 9850), t, 'UPI');
      }
      for (let w = 0; w < 6; w++) {
        txn(s.id, front.id, inr(rng, 55000, 95000), sStart + w * 7 * DAY + rangeInt(rng, 2, 5) * DAY + 15 * HOUR, 'IMPS');
      }
      if (si === 2) {
        addComplaint({
          category: 'Fake job offer', reportedAt: sStart + 30 * DAY, amountLost: 9800,
          victimAccountId: pick(rng, normals).id, namedAccountIds: [s.id],
          city: 'Jaipur', state: 'Rajasthan',
          summary: 'Victim paid a registration fee for a fake data-entry job to the named account.',
        });
      }
    });
    scenarioNotes.push({ ring, title: 'Structured deposit network', description: 'Five recruited accounts each absorb 10-15 sub-Rs-10,000 deposits from many distinct senders, then aggregate weekly into one business front.', size: 6 });
  }

  // ---------- Scenario D: dormant-then-burst ----------
  {
    const ring = 'ring-dormant';
    for (let i = 0; i < 3; i++) {
      const d = addAccount(addCustomer({ declaredIncome: inr(rng, 200000, 500000) }), { openedAt: WINDOW_START - rangeInt(rng, 400, 900) * DAY });
      // old sparse activity
      for (let k = 0; k < rangeInt(rng, 3, 6); k++) {
        txn(d.id, pick(rng, merchants).id, inr(rng, 200, 1800), WINDOW_START - rangeInt(rng, 20, 300) * DAY, 'UPI');
      }
      const burst = Date.UTC(2026, 8, rangeInt(rng, 2, 20)) + 13 * HOUR;
      const total = inr(rng, 180000, 420000);
      const sources = rangeInt(rng, 4, 6);
      for (let s = 0; s < sources; s++) {
        txn(pick(rng, allNormals).id, d.id, Math.round(total / sources), burst + range(rng, 0, 36) * HOUR, 'IMPS');
      }
      for (let o = 0; o < 4; o++) {
        txn(d.id, pick(rng, normals).id, total * range(rng, 0.16, 0.24), burst + range(rng, 4, 52) * HOUR, 'IMPS');
      }
      txn(d.id, 'ATM', total * 0.08, burst + 56 * HOUR, 'ATM');
      gt(d, 'mule-dormant', ring, `Dormant ${rangeInt(rng, 150, 320)} days then 48h burst; no complaint on file`);
    }
    scenarioNotes.push({ ring, title: 'Dormant-burst accounts', description: 'Three long-inactive accounts wake up, absorb Rs 1.8-4.2 lakh from a handful of sources within 36 hours, and empty out within two days. None is named in a complaint - detection must come from behaviour alone.', size: 3 });
  }

  // ---------- Scenario W: witting partial pass-through ----------
  {
    const ring = 'ring-witting';
    for (let i = 0; i < 2; i++) {
      const w = addAccount(addCustomer({ declaredIncome: inr(rng, 300000, 520000) }));
      for (let m = 0; m < 8; m++) {
        txn(pick(rng, employers).id, w.id, inr(rng, 28000, 46000), Date.UTC(2026, m, rangeInt(rng, 1, 4)), 'NEFT');
        txn(w.id, pick(rng, merchants).id, inr(rng, 300, 2200), Date.UTC(2026, m, rangeInt(rng, 5, 26)), 'UPI');
      }
      const t1 = Date.UTC(2026, 6, rangeInt(rng, 4, 24)) + 16 * HOUR;
      const v = mkVictim();
      const amt = inr(rng, 68000, 145000);
      txn(v.id, w.id, amt, t1, 'UPI');
      txn(w.id, pick(rng, normals).id, amt * 0.55, t1 + range(rng, 5, 26) * HOUR, 'IMPS');
      txn(w.id, 'ATM', amt * 0.2, t1 + 2 * DAY, 'ATM');
      gt(w, 'mule-witting', ring, 'Salary-pattern account passing a share of a complaint-linked credit');
      addComplaint({
        category: 'Impersonation - bank official', reportedAt: t1 + rangeInt(rng, 2, 6) * DAY, amountLost: amt,
        victimAccountId: v.id, namedAccountIds: [w.id],
        city: 'Delhi', state: 'Delhi',
        summary: 'Victim was called by a fake bank official and induced to transfer to the named account.',
      });
    }
    scenarioNotes.push({ ring, title: 'Witting mules with cover activity', description: 'Two accounts with ordinary salary histories pass on part of a complaint-linked credit and keep the rest - the hardest pattern for naive rules.', size: 2 });
  }

  // ---------- Scenario R: round-tripping loop ----------
  {
    const ring = 'ring-roundtrip';
    const trio = [0, 1, 2].map(() => {
      const a = addAccount(addCustomer({ occupation: 'Self-employed', declaredIncome: inr(rng, 400000, 900000) }), { type: 'current' });
      gt(a, 'roundtrip', ring, 'Circular transfer loop inflating apparent turnover');
      return a;
    });
    for (let loop = 0; loop < 4; loop++) {
      const start = Date.UTC(2026, 5 + loop, rangeInt(rng, 3, 24)) + 12 * HOUR;
      let amt = inr(rng, 120000, 220000);
      for (let leg = 0; leg < 3; leg++) {
        txn(trio[leg].id, trio[(leg + 1) % 3].id, amt, start + leg * range(rng, 5, 19) * HOUR, 'NEFT');
        amt = Math.round(amt * range(rng, 0.97, 0.995));
      }
    }
    scenarioNotes.push({ ring, title: 'Round-tripping loop', description: 'Three current accounts rotate the same capital in a closed loop, four times, to fabricate turnover.', size: 3 });
  }


  // ---------- Benign hard negatives: legitimate look-alikes ----------
  // The classic false-positive traps. Every detector is judged on how it treats these.
  {
    // (a) Landlord collecting monthly rent from 9 tenants - fan-in aggregation look-alike
    const lord = addAccount(addCustomer({ occupation: 'Retired', declaredIncome: inr(rng, 700000, 1100000) }));
    for (let t = 0; t < 9; t++) {
      const tenant = pick(rng, normals);
      for (let m = 0; m < 9; m++) {
        txn(tenant.id, lord.id, inr(rng, 9000, 16500), Date.UTC(2026, m, rangeInt(rng, 1, 7)) + rangeInt(rng, 9, 20) * HOUR, 'UPI');
      }
    }
    hn(lord, 'Landlord: monthly rent from 9 tenants (fan-in aggregation look-alike)');

    // (b) Coaching institute collecting monthly fees in the 4.5k-9.5k band - structuring look-alike
    const coach = addAccount(addCustomer({ occupation: 'Small business owner', declaredIncome: inr(rng, 900000, 1600000) }), { type: 'current' });
    for (let p = 0; p < 16; p++) {
      const parent = pick(rng, normals);
      for (let m = 0; m < 8; m++) {
        txn(parent.id, coach.id, inr(rng, 4600, 9400), Date.UTC(2026, m, rangeInt(rng, 2, 10)) + rangeInt(rng, 10, 19) * HOUR, 'UPI');
      }
    }
    hn(coach, 'Coaching institute: monthly fees in 4.5-9.5k band from 16 parents (structuring look-alike)');

    // (c) Kitty/committee organizer: collects from 10 friends, pays one winner monthly - fan-in+fan-out look-alike
    const kitty = addAccount(addCustomer({ occupation: 'Homemaker', declaredIncome: inr(rng, 240000, 420000) }));
    const members = Array.from({ length: 10 }, () => pick(rng, normals));
    for (let m = 0; m < 10; m++) {
      const day = Date.UTC(2026, m, rangeInt(rng, 3, 6)) + 18 * HOUR;
      members.forEach((mem) => txn(mem.id, kitty.id, 5000, day + rangeInt(rng, 0, 8) * HOUR, 'UPI'));
      txn(kitty.id, members[m % 10].id, 48000, day + rangeInt(rng, 12, 30) * HOUR, 'IMPS');
    }
    hn(kitty, 'Kitty/committee organizer: pools 10 contributions, pays one winner monthly (fan-in+fan-out look-alike)');

    // (d) Festival-burst merchant: 5x Diwali spike then normal - burst look-alike
    const fest = pick(rng, merchants);
    const festBase = Date.UTC(2026, 9, 1);
    for (let dday = 0; dday < 14; dday++) {
      for (let k = 0; k < rangeInt(rng, 25, 45); k++) {
        txn(pick(rng, normals).id, fest.id, inr(rng, 350, 4800), festBase + dday * DAY + rangeInt(rng, 9, 21) * HOUR, 'UPI');
      }
    }
    hn(fest, 'Festival merchant: 2-week Diwali sales burst (burst/dormancy look-alike)');

    // (e) Sibling pooling family remittances: receives from 3 family accounts, forwards lump sum same day - pass-through look-alike
    const pooler = addAccount(addCustomer({ occupation: 'Salaried', declaredIncome: inr(rng, 500000, 800000) }));
    const parents = addAccount(addCustomer({ occupation: 'Retired', declaredIncome: 300000 }));
    const sibs = Array.from({ length: 3 }, () => pick(rng, normals));
    for (let m = 0; m < 9; m++) {
      const day = Date.UTC(2026, m, rangeInt(rng, 1, 5)) + 10 * HOUR;
      let total = 0;
      sibs.forEach((s) => { const amt = inr(rng, 8000, 14000); total += amt; txn(s.id, pooler.id, amt, day + rangeInt(rng, 0, 6) * HOUR, 'UPI'); });
      txn(pooler.id, parents.id, total, day + rangeInt(rng, 8, 14) * HOUR, 'IMPS');
    }
    hn(pooler, 'Family remittance pooling: collects from 3 siblings, forwards to parents same day (pass-through look-alike)');

    // (f) Salary sweep to own FD account: 60-80% of salary moved within hours - pass-through look-alike
    const saverC = addCustomer({ occupation: 'Salaried', declaredIncome: inr(rng, 800000, 1400000) });
    const salaryAcc = addAccount(saverC);
    const fdAcc = addAccount(saverC);
    const emp = pick(rng, employers);
    for (let m = 0; m < 9; m++) {
      const sal = inr(rng, 72000, 118000);
      const t0 = Date.UTC(2026, m, rangeInt(rng, 1, 3)) + 10 * HOUR;
      txn(emp.id, salaryAcc.id, sal, t0, 'NEFT');
      txn(salaryAcc.id, fdAcc.id, sal * range(rng, 0.6, 0.8), t0 + rangeInt(rng, 2, 6) * HOUR, 'IMPS');
    }
    hn(salaryAcc, 'Salary sweep to own FD account within hours (pass-through look-alike)');
  }

  // ---------- standalone + false-lead complaints ----------
  const falseLead = pick(rng, merchants);
  addComplaint({
    category: 'Online shopping scam', reportedAt: Date.UTC(2026, 8, 2), amountLost: 3499,
    victimAccountId: pick(rng, normals).id, namedAccountIds: [falseLead.id],
    city: 'Surat', state: 'Gujarat',
    summary: 'Buyer dispute; complainant alleges goods not delivered by the merchant.',
  });
  for (let i = 0; i < 14; i++) {
    addComplaint({
      category: pick(rng, COMPLAINT_CATEGORIES),
      reportedAt: WINDOW_START + rangeInt(rng, 30, 270) * DAY,
      amountLost: inr(rng, 2500, 210000),
      victimAccountId: pick(rng, normals).id,
      namedAccountIds: [],
      city: pick(rng, CITIES).city,
      state: pick(rng, CITIES).state,
      summary: 'Beneficiary account is outside the monitored consortium; no in-network account to link.',
    });
  }

  b.txns.sort((x, y) => x.ts - y.ts || x.id.localeCompare(y.id));
  b.complaints.sort((x, y) => x.reportedAt - y.reportedAt);

  return {
    generatedAt: Date.now(),
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    customers: b.customers,
    accounts: b.accounts,
    txns: b.txns,
    complaints: b.complaints,
    groundTruth: b.groundTruth,
    hardNegatives: b.hardNegatives,
    scenarioNotes,
  };
}
