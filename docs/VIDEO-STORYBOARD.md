# Submission video storyboard (8-10 min, official spec)

Official requirement (cyberhackathon.bihar.gov.in/guidelines section 04): explanation + demo video, 8-10 minutes
(10 max), covering the problem statement, proposed architecture/key features/tech stack, and a demonstration of the
working solution. Screen recording + clear voice-over acceptable; faces optional. Upload to team Drive, Viewer access
to hackathonccsubihar@gmail.com, URL on portal before 26 Oct 11:59 pm IST.

Narration language: English (judges national). Team contributes genuine facts only: team name, member names/roles,
who built what. Everything below is screen-recordable as-is.

## 0:00-0:45 - Problem (PS-01)
- Show the official PS-01 statement (portal) for 3 seconds, then title card.
- Voice: mule accounts receive, layer and withdraw cybercrime proceeds; manual threshold-based review is slow and
  misses organised networks. Our platform detects suspected mules from transactional behaviour, fund flows,
  complaints and entity relationships - with explainable scores, not black boxes.

## 0:45-2:00 - Live system, first impression (Overview)
- Screen: Overview page. Count-up KPIs, risk distribution, the live money-movement graph of the highest-risk
  network (particles trace direction and amount).
- Voice: one screen answers "where do I look first" - accounts monitored, open alerts, suspicious networks,
  complaints on file. Every number is explainable; nothing is a verdict.
- Click into the hero graph -> Network explorer.

## 2:00-3:30 - Graph-based investigation (Network)
- Screen: chip selector across communities; select the top network; particles animate; complaint-linked nodes pulse.
- Voice: Louvain communities over the transaction graph. Link analysis surfaces high-centrality hub accounts and
  dense clusters that account-level scores alone can miss. The tool flags structure for review; it does not
  establish anyone's role. Members table and linked complaints sit under the graph.

## 3:30-5:00 - Explainable detection (Account 360)
- Screen: open the highest-risk account. Per-factor breakdown with observed values; complaint linkage; triage
  buttons as shipped: New / In review / Escalated / Cleared (suspicion-for-review workflow states, not verdicts).
- Voice: the score is a sum of named, weighted factors - rapid pass-through, hold time, burst, fan-in/out,
  complaint distance, shared identifiers, dormancy-then-burst, structuring band, relay-only, cash-out share,
  throughput vs declared income. Each shows its observed evidence. Complaint-evidence floor explained.
- Set a triage status; show it lands in the Audit trail (hash-chained, tamper-evidence caveats stated honestly).

## 5:00-6:00 - Money trail (Trails)
- Screen: trace from a complaint-named account backward and forward; hop table with FIFO hypothesis caveat.
- Voice: trails are hypotheses reconstructed FIFO - "terminal inbound total (hypothesis)", never conserved principal.
  Intermediary hops and cash-out endpoints are shown as leads for investigators to verify, not as identified
  real-world actors.

## 6:00-6:45 - Complaint correlation (Complaints)
- Screen: correlated clusters - complaints naming accounts in the same community.
- Voice: NCRP-style complaints correlated with flows; clusters suggest organised operations rather than isolated
  incidents. Complaint data feeds scoring as observed evidence.

## 6:45-7:30 - Works on YOUR data (Import)
- Screen: Import page. Upload the sample CSV, show auto-mapped columns, run analysis, badge flips to
  "Uploaded data - unverified", dashboard re-renders.
- Voice: the same engine runs on uploaded data: local-only parsing (nothing leaves the browser), column mapping
  with common header synonyms, validation with clear per-row errors, and the whole dashboard re-renders. Tested
  with generated CSVs up to about 20,000 transactions / 4,000 accounts in-browser; larger or differently shaped
  exports may need schema adjustment first. Unlabelled data gets explainable scores, never invented accuracy
  numbers.

## 7:30-8:30 - Architecture and rigor (Methodology + Evaluation)
- Screen: Methodology (typologies with published basis, score composition table, limitations) then Evaluation
  (frozen protocol: dev/validation/holdout worlds, hard negatives, honest limits).
- Voice: the primary scorer is a transparent weighted-rule engine - every point is a named factor with observed
  evidence, and the weights were frozen on a development world before any holdout was touched. A separate
  logistic-regression model, trained on the dev world only, is reported as a comparator - it is not blended into
  the operational score. Dev and untouched-holdout results are reported separately, with benign hard negatives.
  No feature reads the generator's labels directly, but complaint-linked fields can still act as a partial proxy,
  and the validity limits say so on screen. Synthetic metrics measure recovery of injected patterns in generated
  worlds only - never claimed as real-world performance. Stack: React + TypeScript front end, deterministic
  seeded generator, graph analytics (Louvain, PageRank, SCC), 39 automated tests including full route-render
  regression.

## 8:30-9:00 - Close
- Screen: Alerts queue (prioritised worklist) -> Overview.
- Voice: suspicion ranked for human review, every score inspectable, every action logged. The repository's commit
  history is available to reviewers.
- End card: team name + members (placeholder card; team fills genuine facts before assembly - do not record
  invented names).

## Recording notes
- Record at 1280x800 or 1080p; dark theme reads well on projectors.
- Keep the "Demo - Synthetic data" pill visible throughout; never crop it out.
- Rehearse twice; keep 30-60s headroom under the 10-minute cap.
- No real banking data anywhere in frame; sample CSV for import is the docs sample (synthetic).
