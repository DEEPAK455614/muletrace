// Orchestrator: generate the world once, compute features, graph analytics, scores,
// communities and the synthetic benchmark. Memoized per session.
import { generateWorld } from './generate';
import { buildGraph } from './graph';
import { computeFeatures, type AccountFeatures } from './features';
import { scoreAll, type ScoreResult } from './scoring';
import { evaluate, type EvalResult } from './evaluate';
import type { World } from './types';
import type { GraphResult } from './graph';

export interface Analysis {
  world: World;
  graph: GraphResult;
  features: Map<string, AccountFeatures>;
  scores: Map<string, ScoreResult>;
  evaluation: EvalResult;
  suspiciousCommunities: { id: number; members: string[]; meanScore: number; maxScore: number; complaintCount: number; flaggedCount: number }[];
  buildMs: number;
}

let cache: Analysis | null = null;

export function analyze(seed = 'muletrace-v1'): Analysis {
  if (cache) return cache;
  const t0 = performance.now();
  const world = generateWorld(seed);
  const graph = buildGraph(world);
  const features = computeFeatures(world, graph);
  const scores = scoreAll(features, graph);
  const evaluation = evaluate(world, scores);

  const communityComplaints = new Map<number, number>();
  const complaintLinked = new Set<string>();
  world.complaints.forEach((c) => c.namedAccountIds.forEach((id) => complaintLinked.add(id)));
  const suspiciousCommunities = graph.communities
    .filter((c) => c.members.length >= 3)
    .map((c) => {
      const memberScores = c.members.map((id) => scores.get(id)?.score ?? 0);
      const meanScore = memberScores.reduce((a, b) => a + b, 0) / memberScores.length;
      const complaintCount = c.members.filter((id) => complaintLinked.has(id)).length;
      const flaggedCount = memberScores.filter((s) => s >= 45).length;
      if (complaintLinked.size) communityComplaints.set(c.id, complaintCount);
      const maxScore = Math.max(...memberScores, 0);
      return { id: c.id, members: c.members, meanScore, maxScore, complaintCount, flaggedCount };
    })
    .filter((c) => c.meanScore >= 25 || c.complaintCount > 0)
    .sort((a, b) => b.maxScore - a.maxScore || b.meanScore - a.meanScore);

  cache = { world, graph, features, scores, evaluation, suspiciousCommunities, buildMs: performance.now() - t0 };
  return cache;
}

export * from './types';
export type { AccountFeatures } from './features';
export type { ScoreResult, FactorContribution } from './scoring';
export { BANDS } from './scoring';
export { traceTrail, traceComplaint, type TrailResult } from './trails';
export { WINDOW_START, WINDOW_END, DAY, HOUR } from './generate';
