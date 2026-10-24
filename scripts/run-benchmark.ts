// Runs the full benchmark protocol and writes:
//   src/data/benchmark.json  (rendered by the Evaluation page)
//   docs/BENCHMARK.md        (human-readable record)
import { runBenchmark } from '../src/engine/benchmark';
import { writeFileSync } from 'node:fs';

const r = runBenchmark();
writeFileSync('src/data/benchmark.json', JSON.stringify(r, null, 2));

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const row = (name: string, e: { threshold: number; precision: number; recall: number; falseAlarmRate: number; tp: number; fp: number; fn: number; hardNegativesFlagged: number; hardNegatives: unknown[] }) =>
  `| ${name} | ${e.threshold} | ${pct(e.precision)} | ${pct(e.recall)} | ${pct(e.falseAlarmRate)} | ${e.tp}/${e.tp + e.fn} | ${e.fp} | ${e.hardNegativesFlagged}/${e.hardNegatives.length} |`;

const worlds = Object.keys(r.rules);
const md = `# Benchmark protocol and results

> Synthetic benchmark only. These numbers measure recovery of typologies injected
> into generated worlds. They are **not** evidence of real-world performance.

## Protocol (frozen before holdout was touched)

- Rule-engine weights: frozen on dev world (\`${r.protocol.devSeed}\`), never re-tuned.
- ML component: logistic regression over ${r.protocol.featureKeys.length} observed features,
  trained **only** on the dev world (${r.protocol.trainCounts.positives} positive / ${r.protocol.trainCounts.negatives} negative accounts).
- Operating threshold: **${r.protocol.threshold}** - ${r.protocol.thresholdRule} (\`${r.protocol.validationSeed}\`).
- Holdout worlds (\`${r.protocol.holdoutSeeds.join('`, `')}\`): evaluated exactly once, after freeze.
- Benign hard negatives: landlord rent fan-in, coaching-fee band, kitty pooling,
  festival burst, family remittance pooling, salary sweep - reported explicitly.
- No label leakage: scoring features are computed from transactions, complaints and
  graph structure only; ground truth is used exclusively for evaluation and (dev-only) training.

Run at: ${r.protocol.trainedAtUtc}

## Rule engine (frozen weights, threshold 45)

| World | Thr | Precision | Recall | False-alarm | Caught | FP | Hard-neg flagged |
|---|---|---|---|---|---|---|---|
${worlds.map((w) => row(w, r.rules[w])).join('\n')}

## Trained model (logistic regression, threshold ${r.protocol.threshold})

| World | Thr | Precision | Recall | False-alarm | Caught | FP | Hard-neg flagged |
|---|---|---|---|---|---|---|---|
${worlds.map((w) => row(w, r.ml[w])).join('\n')}

## Hard-negative detail (holdout-1)

${r.rules['holdout-1'].hardNegatives.map((h) => `- ${h.note} - rules score ${h.score}${h.flagged ? ' (FLAGGED)' : ''}`).join('\n')}

## Reading these numbers

- Dev-world numbers are optimistic by construction (weights were frozen there).
  Trust ordering, not absolutes: holdout numbers are the honest estimate **within
  this synthetic generator**, and still say nothing about production data.
- A flagged hard negative is a detector failure worth studying: each one is a
  legitimate pattern the model must explain, not suppress silently.
`;
writeFileSync('docs/BENCHMARK.md', md);
console.log(md);
