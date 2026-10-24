# MuleTrace - Intelligent Mule Account Detection and Financial Fraud Investigation Platform

Product & technical document - v1.0, 24 Oct 2026
Status: working synthetic prototype, deployed preview. It covers the named PS-01 workflows end to end on synthetic data; it is not audit-ready and not production-ready (see section 6 limitations, and the validity limits in docs/BENCHMARK.md).
Live preview: https://muletrace-5gm.pages.dev - Repo: https://github.com/DEEPAK455614/muletrace (private)
Problem statement: PS-01, supplied as a brief over WhatsApp on 24 Oct 2026. No hackathon, competition, deadline or production customer has been named; nothing below should be read as a submission to, or endorsement by, any organiser or institution.

> Working name "MuleTrace" pending user's naming decision (see docs/NAMING.md).

---

## 1. Problem

Fraud networks recruit or operate "mule" accounts to receive, layer and cash out
proceeds of cybercrime. Banks see single accounts; the fraud lives in the network.
Investigators need: (a) risk-ranked alerts with reasons, (b) the ability to trace
money forward and backward through hops, (c) complaint correlation, (d) network-level
structure that exposes collectors and controllers, (e) an exportable evidence report designed for human review.

## 2. What this system is (and is not)

A full working investigation platform running on a deterministic synthetic dataset:
AI/ML + graph analytics for transaction analysis, mule risk scoring with explanations,
money-trail tracing, complaint correlation, graph-based investigation views, and an
investigation dashboard. The workflows named in PS-01 are all present in working form on the synthetic dataset; this is a prototype demonstration of the scope, not a claim of production capability.

It is NOT connected to any real bank data, does not take account action (no freezing),
does not file complaints, and makes no real-world performance claims. Every score is
"suspicion ranked for human review", never a verdict.

## 3. Architecture

Single-page app (React 18 + TypeScript + Vite, Tailwind v4). All analytics run
client-side in the browser over a generated dataset - no backend required for the demo.

```
src/engine/
  generate.ts   Deterministic seeded world: 461 accounts, ~29k transactions
                (Jan-Oct 2026, INR, UPI/NEFT/IMPS/ATM), customers with declared
                income, devices, addresses; normal life-cycle behaviour (salaries,
                rent, merchants, festivals); 6 injected mule typologies; 6 benign
                hard negatives; 26 NCRP-style complaints.
  graph.ts      Directed weighted graph; PageRank (hand-rolled), Louvain
                communities (graphology), Tarjan SCC (cycle detection), BFS
                distance-to-complaint.
  features.ts   Per-account behavioral features (29): FIFO credit->debit
                pass-through at 24h/72h, median hold time, burst metrics,
                structuring-band share, dormancy-burst, income multiple,
                merchant-spend share, aggregation concentration, shared
                identifiers, community mean signal, PageRank.
  scoring.ts    Transparent weighted rule engine: 14 factors, every point
                explained with observed values; bands Critical>=75 / High>=45 /
                Moderate>=30; complaint-evidence floor. Weights frozen on dev.
  ml.ts         Trained component: logistic regression (29 features, log-scaled
                heavy tails, L2, class-weighted), trained on dev world only.
  benchmark.ts  Evaluation protocol: dev / validation / holdout separation with
                independent seeds; threshold chosen on validation by a rule fixed
                in advance; holdout evaluated once after freeze.
  trails.ts     Time-respecting money-trail tracing (forward/backward, hop
                counts, exit points, complaint-anchored traces).
  evaluate.ts   Confusion, precision@k, PR curve, per-scenario detection,
                hard-negative breakdown.
```

UI pages: Overview, Alert queue (triage workflow, persisted locally), Account 360
(factor rationale, weekly flows, counterparties, complaints, shared identifiers,
triage actions), Network explorer (force-directed community graph), Money trails
(plus flow diagram), Complaints (correlation clusters), Evaluation (protocol +
results), Methodology & limitations, printable Evidence report.

## 4. Detection typologies implemented

Grounded in published sources (full ledger: docs/RESEARCH-SOURCES.md):
rapid dispersal / pass-through, generational layering chains, structuring below
round-number thresholds, dormant activation bursts, income inconsistency, witting
participants with cover activity, round-tripping loops; network proximity,
community signal, shared device/address linkage. Herder/controller roles surface
via network analysis rather than account score (FCA-consistent design choice).

## 5. Evaluation (synthetic benchmark - see docs/BENCHMARK.md for provenance)

Protocol: rule weights frozen on dev world; ML trained on dev only (31 pos / 430 neg);
threshold 35 chosen on validation ("highest recall at precision >= 0.9"); two
holdout worlds with independent seeds evaluated once after freeze. No direct generator-label feature:
features use only observed transactions, complaints and graph structure.

| Scorer | World | Precision | Recall | False-alarm |
|---|---|---|---|---|
| Rules | Dev | 92.3% | 77.4% | 0.5% |
| Rules | Holdout 1 / 2 | 88.9% / 88.9% | 77.4% / 77.4% | 0.7% / 0.7% |
| ML (logreg) | Dev | 93.9% | 100% | 0.5% |
| ML (logreg) | Holdout 1 / 2 | 86.1% / 93.9% | 100% / 100% | 1.2% / 0.5% |

Hard negatives (landlord rent, coaching fees, kitty rotation, festival burst,
remittance pooling, salary sweep): reported per world; rule engine false-flags the
kitty organizer and remittance pooler (documented limitation; separation needs
periodicity/relationship evidence - future work).

These numbers measure recovery of injected typologies inside this generator only.
They are not evidence of real-world performance.

## 6. Honest limitations

- Single-consortium view; no CFCFRMS inter-bank flow, no balances, no KYC docs.
- Synthetic evaluation != production validation; real deployment needs labelled
  bank data, independent model validation, governance sign-off, drift monitoring.
- Scores must never trigger automated action; human review is the design center.
- Herder/off-ramp detection is network-assisted, not score-based (by design).

## 7. Production path (out of demo scope)

Data connectors (core banking, UPI switches, NCRP/CFCFRMS), streaming feature
pipeline, model registry + champion/challenger governance, case management with
RBAC and audit log, STR/CTR drafting assistance, inter-bank consortium exchange,
and regulatory review before any production use.

## 8. Credits

Developed by Sahaj Solutions.
