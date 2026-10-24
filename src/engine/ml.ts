// Trained ML component: logistic regression over observed account features.
//
// Honesty contract (per evaluation-rigor directive):
// - Trained ONLY on the development world (DEV_SEED).
// - Normalization stats (mean/std) computed ONLY on training rows.
// - Operating threshold chosen ONLY on the validation world (VAL_SEED).
// - Holdout worlds (independent seeds) are evaluated exactly once, after
//   everything is frozen, and reported separately.
// - Labels come from the generator's ground truth: legitimate for the
//   synthetic benchmark, never presented as real-world performance.
import type { AccountFeatures } from './features';

export const FEATURE_KEYS = [
  'inCount', 'outCount', 'distinctSources', 'distinctDests',
  'passThrough24h', 'passThrough72h', 'merchantSpendShare', 'aggregationConcentration',
  'medianHoldHours', 'maxTxnsInHour', 'maxTxnsInDay', 'medianTxnsPerActiveDay',
  'newCounterpartyShare', 'longestDormancyDays', 'burstAfterDormancy',
  'structuredDepositShare', 'structuredDepositCount', 'atmShareOut',
  'annualizedThroughput', 'incomeMultiple', 'accountAgeDaysAtEnd',
  'complaintDistance', 'maxComplaintAmountLost', 'sharedDeviceCount', 'sharedAddressCount',
  'sharesIdentifierWithComplaintLinked', 'cycleSize', 'communityMeanSignal', 'pagerank',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

const LOG_KEYS = new Set<FeatureKey>(['medianHoldHours', 'annualizedThroughput', 'maxComplaintAmountLost', 'longestDormancyDays']);

export function featureVector(f: AccountFeatures): number[] {
  return FEATURE_KEYS.map((k) => {
    let v: number;
    if (k === 'burstAfterDormancy' || k === 'sharesIdentifierWithComplaintLinked') v = f[k] ? 1 : 0;
    else if (k === 'complaintDistance') v = !isFinite(f.complaintDistance) ? 4 : Math.min(4, f.complaintDistance);
    else v = f[k] as number;
    if (LOG_KEYS.has(k)) v = Math.log1p(Math.max(0, v));
    return v;
  });
}

export interface LogRegModel {
  featureKeys: readonly FeatureKey[];
  mean: number[]; std: number[];
  weights: number[]; bias: number;
  trainedOn: { seed: string; positives: number; negatives: number; epochs: number; lr: number; l2: number };
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function trainLogReg(
  X: number[][], y: number[], seed: string,
  opts: { epochs?: number; lr?: number; l2?: number } = {},
): LogRegModel {
  const epochs = opts.epochs ?? 1200;
  const lr = opts.lr ?? 0.2;
  const l2 = opts.l2 ?? 1e-3;
  const n = X.length, d = X[0].length;
  const mean = Array(d).fill(0), std = Array(d).fill(0);
  for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j] / n;
  for (const row of X) for (let j = 0; j < d; j++) std[j] += (row[j] - mean[j]) ** 2 / n;
  for (let j = 0; j < d; j++) std[j] = Math.max(Math.sqrt(std[j]), 1e-9);
  const Xs = X.map((row) => row.map((v, j) => (v - mean[j]) / std[j]));

  // class weighting for the ~1:20 imbalance
  const pos = y.filter((v) => v === 1).length, neg = n - pos;
  const wPos = n / (2 * Math.max(1, pos)), wNeg = n / (2 * Math.max(1, neg));

  let weights = Array(d).fill(0), bias = 0;
  for (let e = 0; e < epochs; e++) {
    const gW = Array(d).fill(0);
    let gB = 0;
    for (let i = 0; i < n; i++) {
      const z = bias + Xs[i].reduce((s, v, j) => s + v * weights[j], 0);
      const err = (sigmoid(z) - y[i]) * (y[i] === 1 ? wPos : wNeg);
      for (let j = 0; j < d; j++) gW[j] += err * Xs[i][j];
      gB += err;
    }
    for (let j = 0; j < d; j++) weights[j] -= (lr / n) * (gW[j] + l2 * weights[j]);
    bias -= (lr / n) * gB;
  }
  return {
    featureKeys: FEATURE_KEYS, mean, std, weights, bias,
    trainedOn: { seed, positives: pos, negatives: neg, epochs, lr, l2 },
  };
}

export function predictProb(model: LogRegModel, f: AccountFeatures): number {
  const v = featureVector(f).map((x, j) => (x - model.mean[j]) / model.std[j]);
  return sigmoid(model.bias + v.reduce((s, x, j) => s + x * model.weights[j], 0));
}

export interface ThresholdChoice {
  threshold: number; // on 0-100 probability scale
  rule: string;
  validation: { precision: number; recall: number; f1: number };
}

// Choose the operating threshold on the VALIDATION world only.
// Rule: among thresholds reaching precision >= 0.9, take the one with the
// best recall (investigators tolerate review load, not noise); if none reaches
// 0.9, take the best F1. The rule is fixed before holdout is touched.
export function pickThreshold(probs: Map<string, number>, labels: Set<string>): ThresholdChoice {
  const rows = [...probs.entries()].map(([id, p]) => ({ id, p, pos: labels.has(id) }));
  let best: ThresholdChoice | null = null;
  let bestF1: ThresholdChoice | null = null;
  for (let t = 5; t <= 95; t += 5) {
    let tp = 0, fp = 0, fn = 0;
    for (const r of rows) {
      const flagged = r.p * 100 >= t;
      if (r.pos && flagged) tp++; else if (!r.pos && flagged) fp++; else if (r.pos) fn++;
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const cand = { threshold: t, rule: '', validation: { precision, recall, f1 } };
    if (precision >= 0.9 && (!best || recall > best.validation.recall || (recall === best.validation.recall && t < best.threshold))) best = cand;
    if (!bestF1 || f1 > bestF1.validation.f1) bestF1 = cand;
  }
  const chosen = best ?? bestF1!;
  chosen.rule = best
    ? 'highest-recall threshold achieving precision >= 0.9 on the validation world'
    : 'best-F1 threshold on the validation world (no threshold reached precision 0.9)';
  return chosen;
}
