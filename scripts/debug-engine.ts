import { analyze } from '../src/engine/index';
import { traceComplaint } from '../src/engine/trails';
const a = analyze();
const e = a.evaluation;
console.log('positives', e.positives, 'tp', e.tp, 'fp', e.fp, 'fn', e.fn, 'precision', e.precision.toFixed(2), 'recall', e.recall.toFixed(2), 'FA', e.falseAlarmRate.toFixed(3));
// missed positives by role
const missed: Record<string, number> = {};
Object.entries(a.world.groundTruth).forEach(([id, g]) => {
  const s = a.scores.get(id)!;
  if (s.score < 50) {
    missed[g.role] = (missed[g.role] ?? 0) + 1;
    const top = s.factors.sort((x, y) => y.points - x.points).slice(0, 4).map((f) => `${f.key}:${f.points}`).join(' ');
    console.log('MISS', g.role, g.ring, 'score', s.score, '|', top);
  }
});
// false alarms
a.scores.forEach((s, id) => {
  if (s.score >= 50 && !a.world.groundTruth[id]) {
    const top = [...s.factors].sort((x, y) => y.points - x.points).slice(0, 4).map((f) => `${f.key}:${f.points}`).join(' ');
    console.log('FP', id, 'score', s.score, '|', top);
  }
});
// layering complaint trace debug
const complaint = a.world.complaints.find((c) => c.category === 'Investment scam' && c.namedAccountIds.length > 0)!;
console.log('complaint', complaint.id, 'reportedAt', new Date(complaint.reportedAt).toISOString(), 'named', complaint.namedAccountIds);
const res = traceComplaint(a.world, complaint.id);
console.log('traces', res.length, 'hops', res[0]?.hops.length, 'depth', res[0]?.maxDepth, 'nodes', res[0]?.nodes);
res[0]?.hops.slice(0, 8).forEach((h) => console.log('hop', h.hop, h.from, '->', h.to, h.amount, new Date(h.ts).toISOString().slice(0, 16)));
