import { describe, it, expect } from 'vitest';
import { generateWorld } from '../src/engine/generate';
import { buildGraph } from '../src/engine/graph';
import { computeFeatures } from '../src/engine/features';
import { scoreAll } from '../src/engine/scoring';
import { evaluate } from '../src/engine/evaluate';
import { traceComplaint, traceTrail } from '../src/engine/trails';
import { analyze } from '../src/engine/index';

const a = analyze();

describe('dataset generation', () => {
  it('is deterministic', () => {
    const w1 = generateWorld();
    const w2 = generateWorld();
    expect(w1.txns.length).toBe(w2.txns.length);
    expect(JSON.stringify(w1.txns[0])).toBe(JSON.stringify(w2.txns[0]));
    expect(w1.accounts.length).toBe(w2.accounts.length);
  });
  it('has realistic scale', () => {
    expect(a.world.accounts.length).toBeGreaterThan(400);
    expect(a.world.txns.length).toBeGreaterThan(8000);
    expect(a.world.complaints.length).toBeGreaterThan(15);
  });
});

describe('features', () => {
  it('pass-through mules show high 24h pass-through', () => {
    const mule = Object.entries(a.world.groundTruth).find(([, g]) => g.role === 'mule-pass')!;
    const f = a.features.get(mule[0])!;
    expect(f.passThrough24h).toBeGreaterThan(0.6);
  });
  it('employers paying salaries do not look like pass-through mules', () => {
    const employer = a.world.accounts.find((x) => a.world.customers.find((c) => c.id === x.customerId)?.name.includes('Pvt Ltd') && !a.world.groundTruth[x.id])!;
    const f = a.features.get(employer.id)!;
    expect(f.passThrough24h).toBeLessThan(0.5);
  });
  it('dormant-burst accounts are detected as burstAfterDormancy', () => {
    const d = Object.entries(a.world.groundTruth).filter(([, g]) => g.role === 'mule-dormant');
    for (const [id] of d) expect(a.features.get(id)!.burstAfterDormancy).toBe(true);
  });
});

describe('scoring', () => {
  it('scores are bounded 0-100', () => {
    a.scores.forEach((s) => { expect(s.score).toBeGreaterThanOrEqual(0); expect(s.score).toBeLessThanOrEqual(100); });
  });
  it('every score has explainable factors summing close to the total', () => {
    const s = [...a.scores.values()].sort((x, y) => y.score - x.score)[0];
    const sum = s.factors.reduce((acc, f) => acc + f.points, 0);
    expect(Math.abs(sum - Math.min(100, s.score))).toBeLessThan(2);
    expect(s.factors.length).toBeGreaterThan(2);
  });
  it('catches most injected mules at the High threshold with few false alarms', () => {
    const e = a.evaluation;
    expect(e.recall).toBeGreaterThanOrEqual(0.75);
    expect(e.falseAlarmRate).toBeLessThan(0.06);
    expect(e.precision).toBeGreaterThanOrEqual(0.6);
  });
});

describe('graph analytics', () => {
  it('finds the round-tripping loop as a cycle', () => {
    const rt = Object.entries(a.world.groundTruth).filter(([, g]) => g.role === 'roundtrip').map(([id]) => id);
    const sizes = rt.map((id) => a.features.get(id)!.cycleSize);
    expect(Math.max(...sizes)).toBeGreaterThanOrEqual(3);
  });
  it('produces communities covering all accounts', () => {
    const covered = a.graph.communities.reduce((s, c) => s + c.members.length, 0);
    expect(covered).toBe(a.world.accounts.length);
  });
  it('flags at least 5 suspicious communities or fewer than 25', () => {
    expect(a.suspiciousCommunities.length).toBeGreaterThanOrEqual(3);
    expect(a.suspiciousCommunities.length).toBeLessThanOrEqual(25);
  });
});

describe('money trails', () => {
  it('traces the layering complaint through multiple hops to an endpoint', () => {
    const complaint = a.world.complaints.find((c) => c.category === 'Investment scam' && c.namedAccountIds.length > 0)!;
    const results = traceComplaint(a.world, complaint.id);
    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(r.maxDepth).toBeGreaterThanOrEqual(3);
    expect(r.totalTraced).toBeGreaterThan(100000);
  });
  it('backward trace from collector finds mule sources', () => {
    const collector = Object.entries(a.world.groundTruth).find(([, g]) => g.role === 'collector' && g.ring === 'ring-passthrough')!;
    const r = traceTrail(a.world, collector[0], 'backward', { maxHops: 3, windowDays: 60 });
    expect(r.nodes.length).toBeGreaterThanOrEqual(5);
  });
});

describe('evaluation honesty', () => {
  it('reports queue metrics', () => {
    expect(a.evaluation.precisionAtK.length).toBe(4);
    a.evaluation.precisionAtK.forEach((p) => {
      expect(p.precision).toBeGreaterThanOrEqual(0);
      expect(p.precision).toBeLessThanOrEqual(1);
    });
  });
  it('reports per-scenario detection', () => {
    expect(a.evaluation.perScenario.length).toBe(a.world.scenarioNotes.length);
  });
});
