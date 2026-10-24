# Benchmark protocol and results

> Synthetic benchmark only. These numbers measure recovery of typologies injected
> into generated worlds. They are **not** evidence of real-world performance.

## Protocol (frozen before holdout was touched)

- Rule-engine weights: frozen on dev world (`muletrace-v1`), never re-tuned.
- ML component: logistic regression over 29 observed features,
  trained **only** on the dev world (31 positive / 430 negative accounts).
- Operating threshold: **35** - highest-recall threshold achieving precision >= 0.9 on the validation world (`muletrace-val-2026a`).
- Holdout worlds (`muletrace-holdout-2026a`, `muletrace-holdout-2026b`): evaluated exactly once, after freeze.
- Benign hard negatives: landlord rent fan-in, coaching-fee band, kitty pooling,
  festival burst, family remittance pooling, salary sweep - reported explicitly.
- No label leakage in features: scoring features are computed from transactions,
  complaints and graph structure only; ground truth is used exclusively for evaluation
  and (dev-only) training.
- As-of discipline: each account is scored from the full Jan-Oct 2026 window; complaints
  carry their own report dates and are treated as known for the whole window. There is
  NO per-account temporal cutoff (unlike the arXiv NFPC study's per-account pre-flag
  cutoffs) - a complaint dated late in the window can influence the score of an account
  whose suspicious-looking transactions happened earlier. This mirrors a retrospective
  review, not a real-time alerting deployment, and is stated as a limitation.

## Validity limits (read before quoting any number)

- **Same-template holdouts.** Holdout worlds use independent seeds but the SAME world
  template and the SAME six injected typologies as dev. This tests generalisation to a
  fresh draw from the same generator - NOT unseen typologies, NOT temporal drift, NOT
  out-of-distribution behaviour. Real fraud adaptation would degrade these numbers by
  an unknown amount.
- **Complaint-label correlation.** Injected mule rings are also the accounts most likely
  to attract synthetic complaints, and complaint linkage is a scoring feature. The
  generator creates this correlation deliberately to model victim reporting, but it
  means complaint-aware features partly "read the answer key": synthetic labels and
  complaint assignment are not independent. Precision/recall here are therefore an
  upper bound relative to a deployment where complaints arrive for only a fraction of
  real mules.
- **Hard negatives are template-injected too.** The 6 benign look-alikes are designed
  traps; a real benign population is far more diverse.

Run at: 2026-10-24T15:57:02.790Z

## Rule engine (frozen weights, threshold 45)

| World | Thr | Precision | Recall | False-alarm | Caught | FP | Hard-neg flagged |
|---|---|---|---|---|---|---|---|
| dev | 45 | 92.3% | 77.4% | 0.5% | 24/31 | 2 | 1/6 |
| validation | 45 | 89.3% | 80.6% | 0.7% | 25/31 | 3 | 1/6 |
| holdout-1 | 45 | 88.9% | 77.4% | 0.7% | 24/31 | 3 | 2/6 |
| holdout-2 | 45 | 88.9% | 77.4% | 0.7% | 24/31 | 3 | 1/6 |

## Trained model (logistic regression, threshold 35)

| World | Thr | Precision | Recall | False-alarm | Caught | FP | Hard-neg flagged |
|---|---|---|---|---|---|---|---|
| dev | 35 | 93.9% | 100.0% | 0.5% | 31/31 | 2 | 1/6 |
| validation | 35 | 91.2% | 100.0% | 0.7% | 31/31 | 3 | 1/6 |
| holdout-1 | 35 | 86.1% | 100.0% | 1.2% | 31/31 | 5 | 2/6 |
| holdout-2 | 35 | 93.9% | 100.0% | 0.5% | 31/31 | 2 | 1/6 |

## Hard-negative detail (holdout-1)

- Landlord: monthly rent from 9 tenants (fan-in aggregation look-alike) - rules score 26
- Coaching institute: monthly fees in 4.5-9.5k band from 16 parents (structuring look-alike) - rules score 35
- Kitty/committee organizer: pools 10 contributions, pays one winner monthly (fan-in+fan-out look-alike) - rules score 71 (FLAGGED)
- Festival merchant: 2-week Diwali sales burst (burst/dormancy look-alike) - rules score 19
- Family remittance pooling: collects from 3 siblings, forwards to parents same day (pass-through look-alike) - rules score 49 (FLAGGED)
- Salary sweep to own FD account within hours (pass-through look-alike) - rules score 39

## Reading these numbers

- Dev-world numbers are optimistic by construction (weights were frozen there).
  Trust ordering, not absolutes: holdout numbers are the honest estimate **within
  this synthetic generator**, and still say nothing about production data.
- A flagged hard negative is a detector failure worth studying: each one is a
  legitimate pattern the model must explain, not suppress silently.
