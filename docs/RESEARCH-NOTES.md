# PS-01 Research notes (24 Oct 2026)

## 1. Typologies - how mule networks operate
- Mule = account that receives, transfers, layers or withdraws proceeds of cybercrime; core cash-out infrastructure of scams (Outseer, Feedzai, FATF).
- Three mule types with distinct signals: unwitting (manipulated victim), witting (knows, does it for money), complicit (opens accounts deliberately for laundering) (Outseer, Feedzai).
- Herder: recruits/controls multiple mule accounts (Feedzai).
- Generational layering: 1st-gen mule receives from victim, forwards to 2nd-gen etc. Firms over-focus on 1st-gen alerts and miss later generations (FCA).
- Proven detection indicators (FCA multi-firm review): unexpected/unexplained deposits; rapid dispersal through networks within minutes of receipt; movement to international jurisdictions; rapid ATM withdrawal; large deposits soon after opening exceeding stated income; activity misaligned with stated business; multiple rapid transactions in short period.
- Outseer signals: rapid inbound-to-outbound movement, first-time payees, velocity changes, device/SIM changes, shared identifiers with known fraud, thin account history, links to scam victims; journey-aware scoring across login->payment; multi-signal detection; enforce at outbound payment.
- A mule's individual transfers look ordinary (salary-sized credit, same-day debit, cash withdrawal). What marks a mule is relational (shared counterparties/addresses/devices) + temporal shape (quiet -> burst in -> burst out -> silence) (arXiv RBIH study).
- FATF: cyber-enabled fraud is transnational organised crime; proceeds moved rapidly across jurisdictions; needs detection+prevention strengthening, risk indicators, cross-sector coordination.

## 2. Detection methods
- Production systems remain largely rule-based; rules fire on transactions but decisions concern accounts (arXiv RBIH). Account-level scoring > transaction-level.
- RBIH NFPC study (India, 400M txns, 94k labelled accounts, 2.6% mules): heterogeneous graph from bank schema + temporal per-account cutoffs; GNN 83.2% precision / 90.3% recall at 0.5% false-alarm; trees best at top-100 queue, graph models hold precision deep in queue. Analyst capacity is the operational constraint -> queue metrics P@k/R@k matter more than accuracy. At 2.6% prevalence, accuracy is meaningless.
- Graph algorithms that pay off (Neo4j): weakly connected components (payment chains), PageRank (key players), Louvain (subnetworks/communities), strongly connected components (rings/cycles), entity resolution via shared identifiers + label propagation, pathfinding for layered intermediaries.
- Feedzai blueprint: account-opening controls; mule propensity scoring (ongoing, pre-fraud); inbound payment monitoring; connected decisioning; network-level views across institutions; link analysis (funds transfers, shared devices, IPs); education. Behavioural biometrics as extra signal.
- BioCatch: behavioural biometrics to distinguish genuine user vs mule behaviour at onboarding and transacting.
- Transparent feature + weighted-score engines are the honest choice for a demo: explainable by construction (per-factor reason codes), no fake "trained model" claims. Industry direction = ML/GNN, but every credible source demands explainability and investigator-facing reasons (XAI literature, Unit21 "regulator-ready reasoning", Quantexa "explainable AI").

## 3. Explainability
- XAI fraud literature: SHAP-style factor attribution, analyst-centric triage (X-Shield), regulator-ready decision artefacts. Investigators need: why this score, which indicators contributed, what evidence backs each.
- FCA: firms must record investigation rationale; alerts alone aren't proof; corroborate with supporting info; high evidential standard before reporting a mule. -> Product must present scores as SUSPICION + evidence, never verdict.
- Unit21: full audit trail, documented risk reasoning. Quantexa: explainable AI on trusted data foundation.

## 4. India context (the PS is Indian)
- I4C (Indian Cyber Crime Coordination Centre, MHA): National Cybercrime Reporting Portal (NCRP), helpline 1930, CFCFRMS (Citizen Financial Cyber Fraud Reporting & Management System) - banks/LEA coordination to freeze defrauded money fast.
- I4C Suspect Registry circulated 2M+ first-layer mule accounts to institutions (Parliament replies, cited in arXiv).
- RBI announced MuleHunter.AI (RBIH model) 6 Dec 2024; RBI urging banks to adopt AI models.
- UPI scale: ~228B transactions in 2025 (NPCI cited). Real-time rails shrink response windows.
- UNODC: 2-5% of global GDP laundered annually ($0.8-2T), <1% seized.

## 5. Evaluation & honest claims
- Use PR-AUC / P@k / R@k / false-alarm rate; never accuracy at low prevalence (fraud-detection-handbook, arXiv).
- Alert fatigue is the real constraint: queue depth, precision at analyst budget.
- Any metrics we show must be labelled SYNTHETIC benchmark (self-generated ground truth), not real-world accuracy. Deployment readiness requires real bank data, model validation, governance.

## 6. Investigation workflow & evidence
- Investigation unit = case around account/network; needs timeline, money-trail trace, linked complaints, network view, documented rationale, exportable evidence report.
- FCA: document decisions; checklists help but depth matters; SAR/reporting is separate regulated step (OUT of scope - no official submission).
- Money trail: time-ordered multi-hop tracing from complaint/victim through intermediaries to cash-out/off-ramp; identify generation layers.

## 7. Product/feature vocabulary of leaders (design + scope grounding)
- Quantexa: entity resolution, 360 entity view, graph generation, contextual analytics, decision workflows, human-in-the-loop.
- Unit21: alert->investigation->filing lifecycle, case management, audit trail, device intelligence, consortium data.
- Sardine: real-time risk, device+behaviour signals, agentic investigations.
- Linkurious/KeyLines/Neo4j Bloom/Graphistry/Maltego/Chainalysis Reactor: graph-first investigation UX - expand nodes, time filter, grouping, evidence pins.
- Dashboard guidance (Vectra/fuselab/fintech refs): severity-first triage, show the queue not vanity KPIs, dense but hierarchical, consistent severity palette, timeline context, reduce noise.

## 8. Design decisions fed into the build
- Investigator-first, English, light refined console (not generic dark-terminal trope): paper-white base, ink text, single indigo brand, semantic risk palette (green/amber/red used ONLY for risk), mono font for IDs/amounts.
- Every score shows its working: factor contributions with observed values.
- Synthetic-data honesty everywhere: banner + methodology page + bounded claims in PRD.
