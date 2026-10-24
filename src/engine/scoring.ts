// Transparent weighted risk scoring. Every point of the 0-100 score is attributable
// to a named factor with an observed value - explainable by construction.
// Weights are hand-set from published mule indicators (FCA, Outseer, Feedzai, RBIH
// research) and tuned against this synthetic dataset only. NOT validated on real data.
import type { AccountFeatures } from './features';
import type { GraphResult } from './graph';

export interface FactorContribution {
  key: string;
  label: string;
  points: number;
  max: number;
  observed: string;
}

export interface ScoreResult {
  accountId: string;
  score: number; // 0-100
  band: 'Low' | 'Moderate' | 'High' | 'Critical';
  archetype: string;
  factors: FactorContribution[];
}

export const BANDS = [
  { name: 'Critical', min: 75, color: '#D92D20' },
  { name: 'High', min: 45, color: '#E0651F' },
  { name: 'Moderate', min: 30, color: '#D99A1F' },
  { name: 'Low', min: 0, color: '#1F9D6B' },
] as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface FactorSpec { key: string; label: string; points: number; max: number; observed: string }

export function factorSpecs(f: AccountFeatures): FactorSpec[] {
  const fanIn = f.distinctSources >= 5 && f.distinctDests <= 5;
  const fanOut = f.distinctDests >= 8 && f.distinctSources <= 3;
  const specs: FactorSpec[] = [];
  const pt24 = f.passThrough24h, pt72 = f.passThrough72h;
  specs.push({ key: 'passthrough', label: 'Rapid pass-through (24h)', points: 20 * clamp01((pt24 - 0.25) / 0.65), max: 20,
    observed: `${Math.round(pt24 * 100)}% of inbound funds moved out within 24 hours` });
  specs.push({ key: 'passthrough72', label: 'Pass-through within 72h', points: 12 * clamp01((pt72 - pt24 - 0.15) / 0.5), max: 12,
    observed: `${Math.round(pt72 * 100)}% moved out within 72 hours` });
  specs.push({ key: 'hold', label: 'Short hold time', points: f.medianHoldHours > 0 && f.medianHoldHours < 2 ? 12 : f.medianHoldHours < 12 ? 8 : f.medianHoldHours < 48 ? 4 : 0, max: 12,
    observed: f.medianHoldHours > 0 ? `Median ${f.medianHoldHours.toFixed(1)}h between credit and next debit` : 'No credit-debit pairs' });
  specs.push({ key: 'burst', label: 'Bursty activity', points: 10 * clamp01((f.maxTxnsInDay - 4) / 10), max: 10,
    observed: `Peak ${f.maxTxnsInDay} transactions in one day (median ${f.medianTxnsPerActiveDay})` });
  specs.push({ key: 'fan', label: fanIn ? 'Fan-in / narrow-out pattern' : fanOut ? 'Narrow-in / fan-out pattern' : 'Counterparty concentration',
    points: fanIn || fanOut ? 10 : f.distinctSources >= 6 || f.distinctDests >= 8 ? 4 : 0, max: 10,
    observed: `${f.distinctSources} distinct sources, ${f.distinctDests} distinct destinations` });
  specs.push({ key: 'complaint', label: 'Cybercrime complaint linkage',
    points: f.complaintDistance === 0 ? 26 : f.complaintDistance === 1 ? 9 : f.complaintDistance === 2 ? 5 : 0, max: 26,
    observed: f.complaintDistance === 0 ? 'Named in a cybercrime complaint' : f.complaintDistance === 1 ? 'Directly connected to a complaint-named account' : f.complaintDistance === 2 ? 'Two hops from a complaint-named account' : 'No complaint link' });
  specs.push({ key: 'sharedid', label: 'Shared identifiers', points: (f.sharedDeviceCount >= 3 ? 5 : f.sharedDeviceCount >= 1 ? 2 : 0) + (f.sharesIdentifierWithComplaintLinked ? 3 : 0), max: 8,
    observed: f.sharedDeviceCount > 0 ? `Device shared with ${f.sharedDeviceCount} other account(s)${f.sharesIdentifierWithComplaintLinked ? ', one complaint-linked' : ''}` : f.sharesIdentifierWithComplaintLinked ? 'Identifier shared with complaint-linked account' : 'Unique identifiers' });
  specs.push({ key: 'dormant', label: 'Dormancy then burst', points: f.burstAfterDormancy ? 12 : 0, max: 12,
    observed: f.burstAfterDormancy ? `Silent ${f.longestDormancyDays} days, then burst of Rs 1L+ within 72 hours` : `Longest quiet spell ${f.longestDormancyDays} days` });
  specs.push({ key: 'structuring', label: 'Structured deposits', points: 12 * clamp01((f.structuredDepositShare - 0.35) / 0.4), max: 12,
    observed: `${f.structuredDepositCount} deposits between Rs 4,000-9,900` });
  specs.push({ key: 'relay', label: 'Relay-only account', points: f.outCount >= 1 && f.merchantSpendShare < 0.05 && pt24 > 0.3 ? 8 : 0, max: 8,
    observed: f.merchantSpendShare < 0.05 ? 'No ordinary living spends; account exists only to relay funds' : `${Math.round(f.merchantSpendShare * 100)}% of outflow is ordinary spending` });
  specs.push({ key: 'atm', label: 'Cash-out share', points: f.atmShareOut >= 0.4 ? 8 : f.atmShareOut >= 0.2 ? 4 : 0, max: 8,
    observed: `${Math.round(f.atmShareOut * 100)}% of outflow withdrawn as cash` });
  specs.push({ key: 'income', label: 'Throughput vs declared income', points: f.incomeMultiple >= 5 ? 8 : f.incomeMultiple >= 2.5 ? 4 : 0, max: 8,
    observed: `Annualised throughput ${f.incomeMultiple.toFixed(1)}x declared income` });
  specs.push({ key: 'churn', label: 'Counterparty churn', points: 5 * clamp01((f.newCounterpartyShare - 0.55) / 0.4), max: 5,
    observed: `${Math.round(f.newCounterpartyShare * 100)}% of counterparties seen once` });
  specs.push({ key: 'newacct', label: 'New account, high velocity', points: f.accountAgeDaysAtEnd < 120 && f.inTotal >= 200000 ? 6 : 0, max: 6,
    observed: `Opened ${Math.round(f.accountAgeDaysAtEnd)} days ago` });
  specs.push({ key: 'cycle', label: 'Circular flow participation', points: f.cycleSize >= 3 && f.inTotal >= 100000 && pt24 >= 0.3 && f.merchantSpendShare < 0.2 ? 12 : 0, max: 12,
    observed: f.cycleSize >= 3 ? `Member of a ${f.cycleSize}-account circular flow` : 'No circular flow' });
  return specs;
}

export function preNetworkSignal(f: AccountFeatures): number {
  return factorSpecs(f).reduce((s, x) => s + x.points, 0);
}

export function scoreAccount(f: AccountFeatures): ScoreResult {
  const factors = factorSpecs(f).filter((x) => x.points > 0.05)
    .map((x) => ({ ...x, points: Math.round(x.points * 10) / 10 }));
  let score = factors.reduce((s, x) => s + x.points, 0);
  score += Math.round(10 * clamp01(f.communityMeanSignal / 55) * 10) / 10;
  if (f.communityMeanSignal > 1) {
    factors.push({ key: 'community', label: 'Network community risk', points: Math.round(10 * clamp01(f.communityMeanSignal / 55) * 10) / 10, max: 10,
      observed: 'Peer accounts in its network community average elevated signals' });
  }
  score = Math.min(100, Math.round(score));
  // External-evidence floor: a direct cybercrime complaint naming the account is
  // independent corroboration (I4C/NCRP practice) and guarantees review. Small-amount
  // disputes floor lower so genuine disputes surface without auto-escalating.
  if (f.complaintDistance === 0) {
    const floor = f.maxComplaintAmountLost >= 10000 ? 55 : 45;
    if (score < floor) score = floor;
  }
  const band = (BANDS.find((b) => score >= b.min)?.name ?? 'Low') as ScoreResult['band'];
  return { accountId: f.accountId, score, band, archetype: archetypeOf(f, score, factors), factors };
}

function archetypeOf(f: AccountFeatures, score: number, factors: FactorContribution[]): string {
  const has = (k: string, min = 1) => (factors.find((x) => x.key === k)?.points ?? 0) >= min;
  if (has('cycle', 5)) return 'Round-tripping loop';
  if (f.complaintDistance === 0 && has('passthrough', 10)) return 'Complaint-linked pass-through';
  if (has('fan', 8) && has('passthrough', 8)) return 'Fan-in pass-through mule';
  if (has('passthrough', 12) && f.distinctSources <= 3 && f.distinctDests <= 3) return 'Layering intermediary';
  if (has('structuring', 4)) return 'Structured deposit collector';
  if (has('dormant', 6)) return 'Dormant-burst account';
  if (has('atm', 5) && f.distinctSources >= 4) return 'Cash-out aggregator';
  if (f.complaintDistance === 0) return 'Complaint-named account';
  if (score >= 50) return 'Elevated network risk';
  if (score >= 30) return 'Moderate anomaly';
  return 'No strong pattern';
}

export function scoreAll(features: Map<string, AccountFeatures>, gres: GraphResult): Map<string, ScoreResult> {
  const pre = new Map<string, number>();
  features.forEach((f, id) => pre.set(id, preNetworkSignal(f)));
  const communityMembers = new Map<number, string[]>();
  features.forEach((f, id) => {
    communityMembers.set(f.communityId, [...(communityMembers.get(f.communityId) ?? []), id]);
  });
  features.forEach((f) => {
    const members = (communityMembers.get(f.communityId) ?? []).filter((id) => id !== f.accountId);
    const mean = members.length ? members.reduce((s, id) => s + (pre.get(id) ?? 0), 0) / members.length : 0;
    f.communityMeanSignal = members.length >= 2 && members.length <= 40 ? mean : 0;
  });
  const out = new Map<string, ScoreResult>();
  features.forEach((f, id) => out.set(id, scoreAccount(f)));
  return out;
}
