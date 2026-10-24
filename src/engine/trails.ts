// Money-trail tracing: time-respecting multi-hop flow tracing from a complaint or account.
// Forward = where did the money go; backward = where did it come from.
import type { World, Txn } from './types';
import { DAY } from './generate';

export interface TrailHop {
  txnId: string;
  from: string;
  to: string;
  amount: number;
  ts: number;
  hop: number;
  channel: string;
}

export interface TrailResult {
  seedId: string;
  direction: 'forward' | 'backward';
  hops: TrailHop[];
  nodes: string[];
  endpoints: { id: string; kind: 'cash-out' | 'terminal-account' | 'off-window' ; amount: number }[];
  // Sum of DISTINCT hop transaction amounts (visitedEdges dedupes). In cyclic
  // flows the same funds can be counted on each pass - see exitValue.
  totalTraced: number;
  // Sum of full inbound amounts of hops that arrive at terminal sinks
  // (cash-out, terminal accounts, off-window). Hypothesis only: this is NOT a
  // conserved trace of origin principal - in branched or cyclic flows the same
  // funds may be attributed to more than one sink.
  exitValue: number;
  maxDepth: number;
}

export function traceTrail(
  world: World,
  seedAccountId: string,
  direction: 'forward' | 'backward',
  opts: { maxHops?: number; windowDays?: number; minAmount?: number; sinceTs?: number; seedAmount?: number } = {},
): TrailResult {
  const maxHops = opts.maxHops ?? 6;
  const windowDays = opts.windowDays ?? 30;
  const minAmount = opts.minAmount ?? 1000;
  const txnsByFrom = new Map<string, Txn[]>();
  const txnsByTo = new Map<string, Txn[]>();
  for (const t of world.txns) {
    txnsByFrom.set(t.from, [...(txnsByFrom.get(t.from) ?? []), t]);
    txnsByTo.set(t.to, [...(txnsByTo.get(t.to) ?? []), t]);
  }
  const hops: TrailHop[] = [];
  const nodes = new Set<string>([seedAccountId]);
  const visitedEdges = new Set<string>();
  const endpointAmount = new Map<string, number>();
  const endpointKind = new Map<string, TrailResult['endpoints'][number]['kind']>();
  let maxDepth = 0;

  interface Frame { node: string; hop: number; minTs: number; maxTs: number; amountBudget: number; inboundAmount: number }
  const activity = (txnsByFrom.get(seedAccountId) ?? []).concat(txnsByTo.get(seedAccountId) ?? []).map((t) => t.ts);
  const lastActivity = activity.length ? Math.max(...activity) : world.windowEnd;
  const seedTs = opts.sinceTs ?? (direction === 'forward' ? Math.max(world.windowStart, lastActivity - windowDays * DAY) : lastActivity);
  const stack: Frame[] = [{
    node: seedAccountId, hop: 0,
    minTs: direction === 'forward' ? seedTs : 0,
    maxTs: direction === 'forward' ? Number.MAX_SAFE_INTEGER : seedTs,
    amountBudget: opts.seedAmount ?? Number.MAX_SAFE_INTEGER,
    inboundAmount: 0,
  }];

  while (stack.length) {
    const frame = stack.pop()!;
    if (frame.hop >= maxHops) continue;
    const candidates = direction === 'forward'
      ? (txnsByFrom.get(frame.node) ?? [])
      : (txnsByTo.get(frame.node) ?? []);
    const relevant = candidates
      .filter((t) => (direction === 'forward' ? t.ts >= frame.minTs && t.ts <= frame.minTs + windowDays * DAY : t.ts <= frame.maxTs && t.ts >= frame.maxTs - windowDays * DAY))
      .filter((t) => t.amount >= minAmount)
      .filter((t) => !visitedEdges.has(t.id))
      .filter((t) => (direction === 'forward' ? t.amount <= frame.amountBudget * 1.05 : true))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6); // branch cap keeps the trail readable

    let expanded = false;
    for (const t of relevant) {
      visitedEdges.add(t.id);
      const nextNode = direction === 'forward' ? t.to : t.from;
      hops.push({ txnId: t.id, from: t.from, to: t.to, amount: t.amount, ts: t.ts, hop: frame.hop + 1, channel: t.channel });
      maxDepth = Math.max(maxDepth, frame.hop + 1);
      if (nextNode === 'ATM') {
        endpointAmount.set('ATM (cash withdrawal)', (endpointAmount.get('ATM (cash withdrawal)') ?? 0) + t.amount);
        endpointKind.set('ATM (cash withdrawal)', 'cash-out');
        expanded = true;
        continue;
      }
      if (nextNode === 'EXT') continue;
      nodes.add(nextNode);
      expanded = true;
      stack.push({
        node: nextNode, hop: frame.hop + 1,
        minTs: direction === 'forward' ? t.ts : frame.minTs,
        maxTs: direction === 'forward' ? frame.maxTs : t.ts,
        amountBudget: Math.min(frame.amountBudget, t.amount),
        inboundAmount: t.amount,
      });
    }
    if (!expanded && frame.hop > 0) {
      endpointAmount.set(frame.node, (endpointAmount.get(frame.node) ?? 0) + frame.inboundAmount);
      endpointKind.set(frame.node, 'terminal-account');
    }
  }
  const totalTraced = hops.reduce((s, h) => s + h.amount, 0);
  const endpoints = [...endpointAmount.entries()].map(([id, amount]) => ({
    id, kind: endpointKind.get(id) ?? 'terminal-account', amount,
  }));
  const exitValue = endpoints.reduce((s, e) => s + e.amount, 0);
  return { seedId: seedAccountId, direction, hops, nodes: [...nodes], endpoints, totalTraced, exitValue, maxDepth };
}

export function traceComplaint(world: World, complaintId: string): TrailResult[] {
  const c = world.complaints.find((x) => x.id === complaintId);
  if (!c) return [];
  return c.namedAccountIds.map((accId) =>
    traceTrail(world, accId, 'forward', { sinceTs: c.reportedAt - 21 * DAY, maxHops: 6, windowDays: 21 }),
  );
}
