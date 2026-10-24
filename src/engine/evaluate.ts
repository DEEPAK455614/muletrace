// Synthetic benchmark: scores vs the generator's own ground truth.
// Every number here measures recovery of INJECTED scenarios, not real-world accuracy.
import type { World } from './types';
import type { ScoreResult } from './scoring';

export interface EvalResult {
  totalAccounts: number;
  positives: number;
  threshold: number;
  tp: number; fp: number; fn: number; tn: number;
  precision: number; recall: number; falseAlarmRate: number;
  precisionAtK: { k: number; precision: number; recall: number }[];
  prCurve: { threshold: number; precision: number; recall: number }[];
  perScenario: { ring: string; title: string; size: number; detected: number }[];
}

export function evaluate(world: World, scores: Map<string, ScoreResult>, threshold = 45): EvalResult {
  const positives = new Set(Object.keys(world.groundTruth));
  const ranked = [...scores.values()].sort((a, b) => b.score - a.score);
  let tp = 0, fp = 0, fn = 0, tn = 0;
  scores.forEach((s, id) => {
    const isPos = positives.has(id);
    const flagged = s.score >= threshold;
    if (isPos && flagged) tp++;
    else if (!isPos && flagged) fp++;
    else if (isPos && !flagged) fn++;
    else tn++;
  });
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const falseAlarmRate = fp + tn > 0 ? fp / (fp + tn) : 0;

  const precisionAtK = [10, 25, 50, 100].map((k) => {
    const top = ranked.slice(0, k);
    const hits = top.filter((s) => positives.has(s.accountId)).length;
    return { k, precision: hits / Math.min(k, top.length), recall: hits / positives.size };
  });

  const prCurve = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10].map((t) => {
    let p = 0, f = 0, m = 0;
    scores.forEach((s, id) => {
      const isPos = positives.has(id);
      const flagged = s.score >= t;
      if (isPos && flagged) p++; else if (!isPos && flagged) f++; else if (isPos) m++;
    });
    return { threshold: t, precision: p + f > 0 ? p / (p + f) : 1, recall: p + m > 0 ? p / (p + m) : 0 };
  });

  const perScenario = world.scenarioNotes.map((sn) => {
    const members = Object.entries(world.groundTruth).filter(([, g]) => g.ring === sn.ring);
    const detected = members.filter(([id]) => (scores.get(id)?.score ?? 0) >= threshold).length;
    return { ring: sn.ring, title: sn.title, size: members.length, detected };
  });

  return {
    totalAccounts: world.accounts.length, positives: positives.size, threshold,
    tp, fp, fn, tn, precision, recall, falseAlarmRate, precisionAtK, prCurve, perScenario,
  };
}
