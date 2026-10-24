# Engine notes (internal)

## Weight freeze 2026-10-24 (commit "engine baseline")
Scoring weights in src/engine/scoring.ts are FROZEN as of the first green test run
(precision 0.96 / recall 0.77 / FA 0.2% on the dev world, seed muletrace-v1).
From here: no further tuning against this world. Any further calibration happens
only against the dev split; a holdout world (independent seed + varied scenario
parameters) must stay untouched until final evaluation. Report dev vs holdout separately.

## Known baseline limits (honest, to document in PRD)
- Herder + merchant off-ramp accounts carry little transactional signal by design;
  they surface through network/community views, not the account score (matches FCA
  finding that link analysis, not scoring, uncovers controllers).
- One round-tripping member holds capital ~a month between loops: genuine hard case,
  flagged Moderate via community signal only.
- One FP expected by design: a merchant named in a low-value buyer dispute is floored
  to Moderate review because any open complaint deserves a look.
