// Per-account observable features. Uses only what a bank could observe: the account's
// own transactions, shared identifiers, complaint links, and graph structure.
// No ground-truth labels are read anywhere in this module.
import type { World, Account, Txn } from './types';
import type { GraphResult } from './graph';
import { HOUR, DAY } from './generate';

export interface AccountFeatures {
  accountId: string;
  inCount: number; outCount: number;
  inTotal: number; outTotal: number;
  distinctSources: number; distinctDests: number;
  passThrough24h: number; // share of inbound amount re-debited within 24h (0..1, FIFO)
  passThrough72h: number; // same within 72h
  merchantSpendShare: number; // share of outflow in small UPI spends (< Rs 3,000)
  aggregationConcentration: number; // share of inflow from top <=6 sources when inCount >= 8
  medianHoldHours: number; // median credit -> next debit gap
  maxTxnsInHour: number; maxTxnsInDay: number; medianTxnsPerActiveDay: number;
  newCounterpartyShare: number; // counterparties seen exactly once
  longestDormancyDays: number; burstAfterDormancy: boolean;
  structuredDepositShare: number; // share of inbound credits in 4k-9.9k band when >=6 such credits
  structuredDepositCount: number;
  atmShareOut: number;
  annualizedThroughput: number;
  incomeMultiple: number; // annualized throughput / declared income (0 when income unknown)
  incomeKnown: boolean; // false when declared income is missing/placeholder - income factor must not score
  accountAgeDaysAtEnd: number;
  complaintDistance: number; // 0 = named, 1 = 1 hop, 2 = 2 hops, Infinity
  maxComplaintAmountLost: number; // largest amountLost among complaints naming this account (0 = none)
  sharedDeviceCount: number; sharedAddressCount: number;
  sharesIdentifierWithComplaintLinked: boolean;
  cycleSize: number; // size of SCC it belongs to (1 = none)
  communityId: number;
  communityMeanSignal: number; // mean of peers' pre-network signal subtotal (filled by scoring)
  pagerank: number;
  firstCreditTs: number | null;
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function computeFeatures(world: World, gres: GraphResult): Map<string, AccountFeatures> {
  const byAccountIn = new Map<string, Txn[]>();
  const byAccountOut = new Map<string, Txn[]>();
  for (const a of world.accounts) { byAccountIn.set(a.id, []); byAccountOut.set(a.id, []); }
  for (const t of world.txns) {
    if (byAccountIn.has(t.to)) byAccountIn.get(t.to)!.push(t);
    if (byAccountOut.has(t.from)) byAccountOut.get(t.from)!.push(t);
  }
  const customersById = new Map(world.customers.map((c) => [c.id, c]));
  const byDevice = new Map<string, string[]>();
  const byAddress = new Map<string, string[]>();
  for (const a of world.accounts) {
    byDevice.set(a.deviceId, [...(byDevice.get(a.deviceId) ?? []), a.id]);
    byAddress.set(a.addressId, [...(byAddress.get(a.addressId) ?? []), a.id]);
  }
  const complaintLinked = new Set<string>();
  world.complaints.forEach((c) => c.namedAccountIds.forEach((id) => complaintLinked.add(id)));
  const maxLossByAccount = new Map<string, number>();
  world.complaints.forEach((c) => c.namedAccountIds.forEach((id) => {
    maxLossByAccount.set(id, Math.max(maxLossByAccount.get(id) ?? 0, c.amountLost));
  }));

  const sccOf = new Map<string, number>();
  gres.scc.forEach((comp) => comp.forEach((id) => sccOf.set(id, comp.length)));

  const out = new Map<string, AccountFeatures>();
  for (const a of world.accounts) {
    const ins = byAccountIn.get(a.id)!;
    const outs = byAccountOut.get(a.id)!;
    const realIns = ins.filter((t) => t.from !== 'EXT');
    const realOuts = outs; // ATM allowed as out
    const inTotal = realIns.reduce((s, t) => s + t.amount, 0);
    const outTotal = realOuts.reduce((s, t) => s + t.amount, 0);
    const sources = new Set(realIns.map((t) => t.from));
    const dests = new Set(realOuts.map((t) => t.to));

    // FIFO pass-through: credits matched chronologically against later debits.
    const fifoShare = (windowMs: number): number => {
      const credits = [...realIns].sort((x, y) => x.ts - y.ts);
      const debits = [...realOuts].sort((x, y) => x.ts - y.ts);
      let di = 0; let dRemain = 0; let passedTotal = 0;
      for (const c of credits) {
        while (di < debits.length && debits[di].ts <= c.ts) { di++; }
        if (di >= debits.length) break;
        let k = di; let kRemain = dRemain > 0 && k === di ? dRemain : debits[k].amount;
        if (dRemain <= 0) kRemain = debits[k].amount;
        let need = c.amount;
        while (k < debits.length && debits[k].ts <= c.ts + windowMs && need > 0) {
          const take = Math.min(need, kRemain);
          need -= take; passedTotal += take; kRemain -= take;
          if (kRemain === 0) { k++; if (k < debits.length) kRemain = debits[k].amount; }
        }
        di = k; dRemain = kRemain;
      }
      return inTotal > 0 ? Math.min(1, passedTotal / inTotal) : 0;
    };
    const passThrough24h = fifoShare(24 * HOUR);
    const passThrough72h = fifoShare(72 * HOUR);
    const smallSpends = realOuts.filter((t) => t.to !== 'ATM' && t.channel === 'UPI' && t.amount <= 3000).reduce((s2, t) => s2 + t.amount, 0);
    const merchantSpendShare = outTotal > 0 ? smallSpends / outTotal : 0;
    const bySource = new Map<string, number>();
    for (const t of realIns) bySource.set(t.from, (bySource.get(t.from) ?? 0) + t.amount);
    const topSources = [...bySource.values()].sort((x, y) => y - x).slice(0, 6);
    const aggregationConcentration = realIns.length >= 8 && inTotal > 0 ? topSources.reduce((a2, b2) => a2 + b2, 0) / inTotal : 0;

    // hold times
    const holds: number[] = [];
    for (const c of realIns) {
      const next = realOuts.find((d) => d.ts >= c.ts);
      if (next) holds.push((next.ts - c.ts) / HOUR);
    }
    const medianHoldHours = median(holds);

    // burst
    const hourBuckets = new Map<number, number>();
    const dayBuckets = new Map<number, number>();
    for (const t of [...realIns, ...realOuts]) {
      const hb = Math.floor(t.ts / HOUR);
      const db = Math.floor(t.ts / DAY);
      hourBuckets.set(hb, (hourBuckets.get(hb) ?? 0) + 1);
      dayBuckets.set(db, (dayBuckets.get(db) ?? 0) + 1);
    }
    const dayCounts = [...dayBuckets.values()];
    const maxTxnsInHour = Math.max(0, ...hourBuckets.values());
    const maxTxnsInDay = Math.max(0, ...dayCounts);
    const medianTxnsPerActiveDay = median(dayCounts);

    // counterparty churn
    const cp = new Map<string, number>();
    for (const t of realIns) cp.set(t.from, (cp.get(t.from) ?? 0) + 1);
    for (const t of realOuts) cp.set(t.to, (cp.get(t.to) ?? 0) + 1);
    const cps = [...cp.values()];
    const newCounterpartyShare = cps.length ? cps.filter((n) => n === 1).length / cps.length : 0;

    // dormancy: gaps between consecutive activity days
    const actDays = [...new Set([...realIns, ...realOuts].map((t) => Math.floor(t.ts / DAY)))].sort((a, b) => a - b);
    let longestDormancyDays = 0; let burstAfterDormancy = false;
    for (let i = 1; i < actDays.length; i++) {
      const gap = actDays[i] - actDays[i - 1];
      if (gap > longestDormancyDays) longestDormancyDays = gap;
      if (gap >= 60) {
        // burst within 3 days after the gap?
        const afterTs = actDays[i] * DAY;
        const inflow3d = realIns.filter((t) => t.ts >= afterTs && t.ts <= afterTs + 3 * DAY).reduce((s, t) => s + t.amount, 0);
        if (inflow3d >= 100000) burstAfterDormancy = true;
      }
    }

    // structuring
    const structured = realIns.filter((t) => t.amount >= 4000 && t.amount <= 9900);
    const structuredDepositShare = structured.length >= 6 && realIns.length > 0 ? structured.length / realIns.length : 0;

    const atmOut = realOuts.filter((t) => t.to === 'ATM').reduce((s, t) => s + t.amount, 0);
    const atmShareOut = outTotal > 0 ? atmOut / outTotal : 0;

    const firstTs = actDays.length ? actDays[0] * DAY : null;
    const lastTs = actDays.length ? actDays[actDays.length - 1] * DAY : null;
    const spanDays = firstTs && lastTs ? Math.max(30, (lastTs - firstTs) / DAY + 1) : 30;
    const annualizedThroughput = (inTotal / spanDays) * 365;
    const cust = customersById.get(a.customerId);
    const incomeKnown = Boolean(cust && cust.declaredIncome > 0);
    const incomeMultiple = incomeKnown ? annualizedThroughput / cust!.declaredIncome : 0;

    const devPeers = byDevice.get(a.deviceId) ?? [];
    const addrPeers = byAddress.get(a.addressId) ?? [];
    const sharesIdentifierWithComplaintLinked =
      devPeers.some((p) => p !== a.id && complaintLinked.has(p)) ||
      addrPeers.some((p) => p !== a.id && complaintLinked.has(p));

    out.set(a.id, {
      accountId: a.id,
      inCount: realIns.length, outCount: realOuts.length,
      inTotal, outTotal,
      distinctSources: sources.size, distinctDests: dests.size,
      passThrough24h, passThrough72h,
      merchantSpendShare, aggregationConcentration,
      medianHoldHours,
      maxTxnsInHour, maxTxnsInDay, medianTxnsPerActiveDay,
      newCounterpartyShare,
      longestDormancyDays, burstAfterDormancy,
      structuredDepositShare, structuredDepositCount: structured.length,
      atmShareOut,
      annualizedThroughput, incomeMultiple, incomeKnown,
      accountAgeDaysAtEnd: (world.windowEnd - a.openedAt) / DAY,
      complaintDistance: gres.distToComplaint[a.id] ?? Infinity,
      maxComplaintAmountLost: maxLossByAccount.get(a.id) ?? 0,
      sharedDeviceCount: devPeers.length - 1, sharedAddressCount: addrPeers.length - 1,
      sharesIdentifierWithComplaintLinked,
      cycleSize: sccOf.get(a.id) ?? 1,
      communityId: gres.community[a.id] ?? -1,
      communityMeanSignal: 0,
      pagerank: gres.pagerank[a.id] ?? 0,
      firstCreditTs: firstTs,
    });
  }
  return out;
}
