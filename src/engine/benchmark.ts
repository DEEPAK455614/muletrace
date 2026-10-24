// Benchmark protocol: dev / validation / holdout separation with independent seeds.
//
// Protocol (fixed BEFORE any holdout is generated for scoring):
//   1. Rule-engine weights were frozen on DEV_SEED and never touched again.
//   2. The logistic-regression model trains on DEV_SEED only.
//   3. Its operating threshold is chosen on VAL_SEED only, by a rule fixed in advance.
//   4. HOLDOUT_SEEDS (independent seeds) are evaluated exactly once with both
//      scorers and reported separately. No component may be adjusted after
//      seeing holdout numbers.
//   5. Benign hard negatives (landlord, coaching fees, kitty, festival merchant,
//      remittance pooling, salary sweep) are reported explicitly in every world.
import { generateWorld } from './generate';
import { buildGraph } from './graph';
import { computeFeatures, type AccountFeatures } from './features';
import { scoreAll } from './scoring';
import { evaluate, type EvalResult } from './evaluate';
import { trainLogReg, predictProb, pickThreshold, featureVector, FEATURE_KEYS } from './ml';
import type { World } from './types';

export const DEV_SEED = 'muletrace-v1';
export const VAL_SEED = 'muletrace-val-2026a';
export const HOLDOUT_SEEDS = ['muletrace-holdout-2026a', 'muletrace-holdout-2026b'] as const;

export interface WorldAnalysis {
  world: World;
  features: Map<string, AccountFeatures>;
}

function analyzeWorld(seed: string): WorldAnalysis {
  const world = generateWorld(seed);
  const graph = buildGraph(world);
  const features = computeFeatures(world, graph);
  scoreAll(features, graph); // fills communityMeanSignal used by ML features
  return { world, features };
}

export interface BenchmarkResult {
  protocol: {
    devSeed: string;
    validationSeed: string;
    holdoutSeeds: string[];
    featureKeys: string[];
    threshold: number;
    thresholdRule: string;
    trainedAtUtc: string;
    trainCounts: { positives: number; negatives: number };
    note: string;
  };
  rules: Record<string, EvalResult>;
  ml: Record<string, EvalResult>;
}

export function runBenchmark(): BenchmarkResult {
  const dev = analyzeWorld(DEV_SEED);
  const val = analyzeWorld(VAL_SEED);

  const labelsOf = (w: World) => new Set(Object.keys(w.groundTruth));

  // --- train on dev only ---
  const ids = [...dev.features.keys()];
  const X = ids.map((id) => featureVector(dev.features.get(id)!));
  const y = ids.map((id) => (labelsOf(dev.world).has(id) ? 1 : 0));
  const model = trainLogReg(X, y, DEV_SEED);

  // --- threshold on validation only ---
  const valProbs = new Map<string, number>();
  val.features.forEach((f, id) => valProbs.set(id, predictProb(model, f)));
  const choice = pickThreshold(valProbs, labelsOf(val.world));

  // --- evaluate both scorers everywhere; holdout exactly once ---
  const evalRules = (wa: WorldAnalysis) => evaluate(wa.world, scoreAll(wa.features, buildGraph(wa.world)), 45);
  const evalMl = (wa: WorldAnalysis) => {
    const m = new Map<string, { score: number } & Record<string, unknown>>();
    wa.features.forEach((f, id) => m.set(id, { accountId: id, score: predictProb(model, f) * 100 } as never));
    return evaluate(wa.world, m as never, choice.threshold);
  };

  const holdouts = HOLDOUT_SEEDS.map((s) => ({ seed: s, ...analyzeWorld(s) }));

  const rules: Record<string, EvalResult> = { dev: evalRules(dev), validation: evalRules(val) };
  const ml: Record<string, EvalResult> = { dev: evalMl(dev), validation: evalMl(val) };
  holdouts.forEach((h, i) => {
    rules[`holdout-${i + 1}`] = evalRules(h);
    ml[`holdout-${i + 1}`] = evalMl(h);
  });

  return {
    protocol: {
      devSeed: DEV_SEED,
      validationSeed: VAL_SEED,
      holdoutSeeds: [...HOLDOUT_SEEDS],
      featureKeys: [...FEATURE_KEYS],
      threshold: choice.threshold,
      thresholdRule: choice.rule,
      trainedAtUtc: new Date().toISOString(),
      trainCounts: { positives: model.trainedOn.positives, negatives: model.trainedOn.negatives },
      note: 'Synthetic benchmark only. Numbers measure recovery of injected typologies in generated worlds; they are not evidence of real-world performance. Holdout worlds were evaluated once, after model, threshold and weights were frozen.',
    },
    rules,
    ml,
  };
}
