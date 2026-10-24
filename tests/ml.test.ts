import { describe, it, expect } from 'vitest';
import { trainLogReg, predictProb, pickThreshold, featureVector, FEATURE_KEYS } from '../src/engine/ml';
import { runBenchmark, DEV_SEED, VAL_SEED, HOLDOUT_SEEDS } from '../src/engine/benchmark';
import { generateWorld } from '../src/engine/generate';
import { buildGraph } from '../src/engine/graph';
import { computeFeatures } from '../src/engine/features';
import { scoreAll } from '../src/engine/scoring';

describe('logistic regression', () => {
  it('learns a cleanly separable problem', () => {
    const X: number[][] = [], y: number[] = [];
    for (let i = 0; i < 200; i++) { X.push([Math.random(), Math.random(), Math.random(), Math.random()]); y.push(0); }
    for (let i = 0; i < 40; i++) { X.push([8 + Math.random(), 8 + Math.random(), Math.random(), Math.random()]); y.push(1); }
    // pad to 29 features to match the model contract
    const Xp = X.map((r) => [...r, ...Array(FEATURE_KEYS.length - 4).fill(0)]);
    const m = trainLogReg(Xp, y, 'unit-test');
    const scoreOf = (row: number[]) => {
      const z = m.bias + row.map((v, j) => (v - m.mean[j]) / m.std[j]).reduce((s, v, j) => s + v * m.weights[j], 0);
      return 1 / (1 + Math.exp(-z));
    };
    const posMean = Xp.filter((_, i) => y[i] === 1).reduce((s, r) => s + scoreOf(r), 0) / 40;
    const negMean = Xp.filter((_, i) => y[i] === 0).reduce((s, r) => s + scoreOf(r), 0) / 200;
    expect(posMean).toBeGreaterThan(0.9);
    expect(negMean).toBeLessThan(0.1);
  });

  it('featureVector handles Infinity complaint distance without NaN', () => {
    const f = {
      accountId: 'A1', inCount: 5, outCount: 4, inTotal: 1000, outTotal: 900,
      distinctSources: 3, distinctDests: 2, passThrough24h: 0.5, passThrough72h: 0.6,
      merchantSpendShare: 0.1, aggregationConcentration: 0.4, medianHoldHours: 10,
      maxTxnsInHour: 2, maxTxnsInDay: 5, medianTxnsPerActiveDay: 1.5,
      newCounterpartyShare: 0.5, longestDormancyDays: 30, burstAfterDormancy: false,
      structuredDepositShare: 0, structuredDepositCount: 0, atmShareOut: 0.05,
      annualizedThroughput: 50000, incomeMultiple: 1.2, accountAgeDaysAtEnd: 400,
      complaintDistance: Infinity, maxComplaintAmountLost: 0, sharedDeviceCount: 0,
      sharedAddressCount: 0, sharesIdentifierWithComplaintLinked: false,
      cycleSize: 1, communityId: 3, communityMeanSignal: 10, pagerank: 0.001,
      firstCreditTs: 123,
    };
    const v = featureVector(f);
    expect(v.length).toBe(FEATURE_KEYS.length);
    expect(v.every((x) => Number.isFinite(x))).toBe(true);
  });
});

describe('benchmark protocol', () => {
  it('uses distinct seeds for dev, validation and holdouts', () => {
    const all = [DEV_SEED, VAL_SEED, ...HOLDOUT_SEEDS];
    expect(new Set(all).size).toBe(all.length);
  });

  it('every world carries benign hard negatives disjoint from ground truth', () => {
    for (const seed of [DEV_SEED, VAL_SEED, ...HOLDOUT_SEEDS]) {
      const w = generateWorld(seed);
      const ids = Object.keys(w.hardNegatives);
      expect(ids.length).toBeGreaterThanOrEqual(5);
      for (const id of ids) expect(w.groundTruth[id]).toBeUndefined();
    }
  });

  it('records full provenance and evaluates holdout for both scorers', () => {
    const r = runBenchmark();
    expect(r.protocol.thresholdRule).toContain('validation');
    expect(r.protocol.holdoutSeeds).toEqual([...HOLDOUT_SEEDS]);
    expect(r.protocol.trainCounts.positives).toBeGreaterThan(10);
    for (const h of ['holdout-1', 'holdout-2']) {
      expect(r.rules[h].totalAccounts).toBeGreaterThan(300);
      expect(r.ml[h].totalAccounts).toBe(r.rules[h].totalAccounts);
      expect(r.ml[h].hardNegatives.length).toBeGreaterThanOrEqual(5);
    }
    // ML threshold must come from the picker, not the rule-engine default
    expect(r.protocol.threshold).not.toBe(45);
  }, 30000);

  it('rule engine flags at most a minority of hard negatives per world', () => {
    // guard-rail: if someone retunes carelessly and starts flagging most
    // benign look-alikes, this test fails loudly.
    const w = generateWorld(DEV_SEED);
    const g = buildGraph(w);
    const f = computeFeatures(w, g);
    const scores = scoreAll(f, g);
    const flagged = Object.keys(w.hardNegatives).filter((id) => (scores.get(id)?.score ?? 0) >= 45);
    expect(flagged.length).toBeLessThanOrEqual(2);
  });
});
