// Graph analytics over the generated world: structure, PageRank, Louvain communities,
// strongly connected components, and BFS distances to complaint-linked accounts.
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import { degreeCentrality } from 'graphology-metrics/centrality/degree';
import type { World } from './types';
import { makeRng } from './rng';

export interface GraphResult {
  graph: Graph;
  pagerank: Record<string, number>;
  community: Record<string, number>;
  communities: { id: number; members: string[] }[];
  scc: string[][]; // strongly connected components with size >= 2
  distToComplaint: Record<string, number>; // BFS hops to nearest complaint-linked account
}

// Simple iterative PageRank (weighted) to avoid depending on graphology-metrics pagerank signature.
function pagerankWeighted(g: Graph, damping = 0.85, iterations = 40): Record<string, number> {
  const nodes = g.nodes();
  const n = nodes.length;
  let pr: Record<string, number> = {};
  nodes.forEach((node) => (pr[node] = 1 / n));
  for (let it = 0; it < iterations; it++) {
    const next: Record<string, number> = {};
    nodes.forEach((node) => (next[node] = (1 - damping) / n));
    nodes.forEach((node) => {
      const out: { neighbor: string; weight: number }[] = [];
      g.forEachOutboundNeighbor(node, (neighbor, attrs) => out.push({ neighbor, weight: (attrs.weight as number) || 1 }));
      const total = out.reduce((s, e) => s + e.weight, 0);
      if (total === 0) {
        const share = (damping * pr[node]) / n;
        nodes.forEach((m) => (next[m] += share));
      } else {
        out.forEach(({ neighbor, weight }) => (next[neighbor] += (damping * pr[node] * weight) / total));
      }
    });
    pr = next;
  }
  return pr;
}

function stronglyConnectedComponents(g: Graph): string[][] {
  // Tarjan's algorithm, iterative.
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: string[][] = [];
  let counter = 0;

  const strongconnect = (start: string) => {
    const work: { node: string; childIter: string[] }[] = [{ node: start, childIter: g.outNeighbors(start) }];
    index.set(start, counter); low.set(start, counter); counter++;
    stack.push(start); onStack.add(start);
    while (work.length) {
      const frame = work[work.length - 1];
      if (frame.childIter.length) {
        const w = frame.childIter.shift()!;
        if (!index.has(w)) {
          index.set(w, counter); low.set(w, counter); counter++;
          stack.push(w); onStack.add(w);
          work.push({ node: w, childIter: g.outNeighbors(w) });
        } else if (onStack.has(w)) {
          low.set(frame.node, Math.min(low.get(frame.node)!, index.get(w)!));
        }
      } else {
        work.pop();
        if (work.length) {
          const parent = work[work.length - 1].node;
          low.set(parent, Math.min(low.get(parent)!, low.get(frame.node)!));
        }
        if (low.get(frame.node) === index.get(frame.node)) {
          const comp: string[] = [];
          let w: string;
          do {
            w = stack.pop()!; onStack.delete(w); comp.push(w);
          } while (w !== frame.node);
          if (comp.length >= 2) out.push(comp);
        }
      }
    }
  };

  g.forEachNode((node) => { if (!index.has(node)) strongconnect(node); });
  return out;
}

export function buildGraph(world: World): GraphResult {
  const g = new Graph({ type: 'directed', multi: false });
  const accountIds = new Set(world.accounts.map((a) => a.id));
  world.accounts.forEach((a) => g.addNode(a.id, { kind: 'account' }));

  // transfer edges aggregated by ordered pair
  const edgeWeights = new Map<string, number>();
  for (const t of world.txns) {
    if (t.to === 'ATM') continue;
    if (!accountIds.has(t.from) || !accountIds.has(t.to)) continue;
    const key = `${t.from}->${t.to}`;
    edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + t.amount);
  }
  for (const [key, w] of edgeWeights) {
    const [from, to] = key.split('->');
    g.addEdge(from, to, { weight: w });
  }

  // shared-identifier edges (device/address/phone) as weak undirected links
  const byDevice = new Map<string, string[]>();
  const byAddress = new Map<string, string[]>();
  for (const a of world.accounts) {
    byDevice.set(a.deviceId, [...(byDevice.get(a.deviceId) ?? []), a.id]);
    byAddress.set(a.addressId, [...(byAddress.get(a.addressId) ?? []), a.id]);
  }
  const addUndirectedWeak = (ids: string[]) => {
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const w = 40000; // weak weight vs typical transfers
        if (g.hasEdge(ids[i], ids[j])) g.setEdgeAttribute(ids[i], ids[j], 'weight', g.getEdgeAttribute(ids[i], ids[j], 'weight') + w);
        else g.addEdge(ids[i], ids[j], { weight: w });
        if (g.hasEdge(ids[j], ids[i])) g.setEdgeAttribute(ids[j], ids[i], 'weight', g.getEdgeAttribute(ids[j], ids[i], 'weight') + w);
        else g.addEdge(ids[j], ids[i], { weight: w });
      }
  };
  for (const ids of byDevice.values()) if (ids.length > 1 && ids.length <= 8) addUndirectedWeak(ids);
  for (const ids of byAddress.values()) if (ids.length > 1 && ids.length <= 8) addUndirectedWeak(ids);

  const pagerank = pagerankWeighted(g);
  const community = louvain(g, { getEdgeWeight: 'weight', resolution: 1, rng: makeRng('louvain:' + world.seed) }) as Record<string, number>;
  const communityMap = new Map<number, string[]>();
  Object.entries(community).forEach(([node, c]) => {
    communityMap.set(c, [...(communityMap.get(c) ?? []), node]);
  });
  const communities = [...communityMap.entries()].map(([id, members]) => ({ id, members }));
  const scc = stronglyConnectedComponents(g);

  // BFS distance to nearest complaint-linked account (undirected hops, transfer graph only)
  const seeds = new Set<string>();
  world.complaints.forEach((c) => c.namedAccountIds.forEach((id) => { if (accountIds.has(id)) seeds.add(id); }));
  const dist: Record<string, number> = {};
  const queue: string[] = [];
  seeds.forEach((s) => { dist[s] = 0; queue.push(s); });
  while (queue.length) {
    const cur = queue.shift()!;
    g.forEachNeighbor(cur, (nb) => {
      if (dist[nb] === undefined) { dist[nb] = dist[cur] + 1; queue.push(nb); }
    });
  }
  degreeCentrality(g);
  return { graph: g, pagerank, community, communities, scc, distToComplaint: dist };
}
