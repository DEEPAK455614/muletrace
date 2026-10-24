# Workbench redesign - reference findings and interaction architecture
Date: 2026-10-25. Branch: workbench. Trigger: user rejected page-based dashboard UI (0/10), asked for six core PS-01 features first, 10/10 interactivity, real investigation workflow.

## Reference study (honest coverage: 11 sources studied this pass, more during build)
1. Chainalysis investigator collaboration case study (alannafischer.com/work/chainalysis) - structured identification over free text; calibrated trust labels on every submission ("structured but unverified").
2. Chainalysis Reactor product + Behance design exploration - graph-first tracing; auto-interpreted human-readable steps; cluster naming/connection UI.
3. Capital One fraud analyst tooling case study (jackiecurry.github.io/capital-one.html) - order every case view: verdict, then justification, then raw evidence; risk red reserved for the verdict only, never for evidence; graph nodes same size so shape is read before magnitude; clinical low-color canvas so alarm colors stay meaningful.
4. AWS fraud investigation redesign (ashwini-design.com/fraud-investigation) - investigators' top complaint was tool-switching; fix = unified single-screen task view; fewer colors, clear hierarchy.
5. NICE Actimize Link Analysis redesign (niharikasn.com/graph) - collapse parallel multi-links into one line with relationship list; node-type filtering; on-demand node detail; highlight rings/commonly-shared identifiers.
6. Unit21 Alert Scores UX case study (aaizakhalid.com) - explainable-AI alert scoring 0-100.
7. Unit21 Explainable CRR (unit21.ai blog) - attribute-level breakdown of how each ML score was computed, surfaced inside the alert/case view.
8. Unit21 alert scoring blog - queue clutter is the enemy; scoring exists to prioritize review, not to verdict.
9. Risk Ops workbench case study (sandunf.com) - centralized workbench turning black-box AI scores into transparent actionable insight, full context without hunting.
10. Cardinal investigation storyboards (docs.cardinalhq.io) - an investigation reads as ordered scenes, each a statement with a support state; keyboard-navigable thread of argument.
11. Investigation-surface design specs (github, two docs) - detail panel slides in ALONGSIDE the canvas, never a modal ("modals interrupt context"); selected item first, linked evidence next, wider findings in tabs/drawers so selection context never leaves the screen.

## Distilled principles for this build
- One workbench screen per investigation question; no page-hunting mid-flow.
- Graph is the primary instrument; selection opens a side evidence panel (graph stays visible).
- Verdict -> justification -> evidence ordering everywhere (score, then factors, then raw transactions).
- Alarm colors only for risk state; everything else low-saturation.
- Every model output carries its basis and its limit next to it (suspicion-for-review framing preserved).
- Multi-transaction account links collapse to one edge with an aggregate label.

## The six workflows (PS-01 order) and their workbench form
1. Transaction analysis -> Home workbench: ranked queue (left) + network graph (center) + evidence panel (right). Pattern chips on queue rows name the observed factors.
2. Mule detection / dynamic risk -> Queue ranking + score header in evidence panel with factor bars (rules) and, when ML scorer is selected, model probability + weight-derived contributions.
3. Money trail -> Trail mode: evidence panel or full-canvas flow with hop stepping (prev/next hop, keyboard arrows), hop table synced to the highlighted edge.
4. Complaint correlation -> New correlation view: complaints clustered by shared named accounts/entities; cross-complaint accounts listed with their complaint count and links.
5. Graph investigation -> Existing Louvain explorer upgraded: node selection opens evidence panel; community chips; ring highlighting.
6. Dashboard/reports -> Queue-as-dashboard (triage inline, audit entry written on status change), chronological transaction timeline per account, printable per-account report preserved.

## ML integration (bounded, honest)
- engine/ml.ts logistic regression (trained on synthetic dev world only, benchmark frozen) becomes a selectable scorer: Rules (default, operational) | ML model (clearly labelled: trained on synthetic demo data, not validated on real banking data).
- ML explanation = per-feature contribution: weight_i * standardized_value_i, ranked, shown as positive/negative contributors. This is model attribution, NOT evidence; labelled exactly that. Rules factor bars stay separate and unchanged. Where a contribution view cannot be produced correctly for an account, show "explanation unavailable" rather than a wrong one.
- No retraining, no threshold changes, no blending into the operational rules score.

## New components to build
- TransactionTimeline (chronological in/out list per account, direction + counterparty + channel, virtualized).
- ComplaintCorrelation (shared-account complaint clusters).
- ScorerToggle + ML contributions panel.
- Workbench shell (queue + graph + slide-in evidence panel), trail hop-stepper.
- Preserve: engine, benchmark, evaluation page, methodology, import, audit chain, report page.
