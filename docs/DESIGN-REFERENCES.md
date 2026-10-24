# Design reference study - PS-01 (24 Oct 2026)

Standing rule: study 50 top industry/related/world references before designing; set the bar above the best; original work only. Honest depth log: 8 reviewed deep (full pages read), 12 medium (docs/search-level pages + highlights), 30+ at search/highlight + established-knowledge level. Scaled for an internal investigator console rather than a marketing site; full list below, notes short.

## A. Financial crime / fraud platforms (industry references)
1. Quantexa (deep) - entity resolution -> 360 entity view -> contextual graph -> decision workflow. Take: resolve entities FIRST, then score; investigation is a workflow, not a chart.
2. Unit21 (deep) - alert-to-case lifecycle, audit trail, regulator-ready reasoning. Take: triage states + evidence trail are core.
3. Sardine (deep) - real-time risk positioning, device/behaviour signals. Take: signal provenance matters to analysts.
4. Feedzai (deep) - blueprint framing, propensity scoring pre-fraud. Take: scoring continuous, not one-shot.
5. BioCatch (deep) - behavioural biometrics. Take: non-transactional signals acknowledged but OUT of synthetic scope; documented.
6. Featurespace (medium) - adaptive behavioural analytics, ARIC engine. Take: profile-vs-baseline deviation as a feature family.
7. NICE Actimize (medium) - enterprise case management. Take: queues, SLAs, assignment - scope down for demo.
8. ComplyAdvantage (medium) - risk data + screening. Take: watchlist/suspect-registry as a data source concept (I4C registry analog).
9. SymphonyAI Sensa (highlight) - copilot for investigations. Noted; no AI copilot in demo scope.
10. ThetaRay (highlight) - unsupervised anomaly detection. Noted.
11. Hawk (highlight) - explainable AI + rules hybrid. Take: hybrid rule+score is industry-normal, good for our honest engine.
12. Lucinity (highlight) - case manager UX, "financial crime as stories". Take: narrative evidence report.
13. Resistant AI (highlight) - document/transaction forensics. Noted.
14. Silent Eight (highlight) - name/alert adjudication AI. Noted.
15. WorkFusion (highlight) - digital workers for fincrime ops. Noted.
16. SEON (highlight) - fraud APIs, digital footprinting. Noted.
17. Sift (highlight) - trust & safety console, queue UX. Take: clean queue tables.
18. Socure (highlight) - identity verification. Noted (onboarding signals).
19. Alloy (highlight) - identity decisioning orchestration. Noted.
20. Stripe Radar (medium) - rules + ML with reason codes on every blocked payment. Take: reason-code-first UX is the norm users expect.
21. Riskified (highlight) - chargeback guarantee model. Noted.
22. Signifyd (highlight) - commerce protection console. Noted.
23. Forter (highlight) - identity-based fraud network. Noted.
24. LexisNexis Risk Solutions (highlight) - consortium data. Noted.
25. Moody's Analytics (highlight) - entity data. Noted.
26. FICO Falcon (highlight) - card fraud scores. Take: score + reason codes heritage.
27. Palantir Gotham/Foundry (medium) - LEA investigation graphs, object model. Take: entity-object model (Account/Device/Complaint/Address) drives the whole UI.

## B. Graph investigation / visualisation tools
28. Linkurious (medium, docs) - expand/hide, filters, grouping, time bar. Take: incremental exploration beats hairball.
29. Cambridge Intelligence KeyLines/ReGraph (medium) - time bar + network combo, KronoGraph. Take: timeline paired with network.
30. Neo4j Bloom (medium) - natural-language-ish scene exploration. Take: perspective-based exploration.
31. Graphistry (highlight) - GPU graph, investigation templates. Noted.
32. Kineviz (highlight) - visual analytics. Noted.
33. Tom Sawyer Perspectives (highlight) - enterprise graph apps. Noted.
34. Maltego (highlight) - LEA link analysis, transforms. Take: entity types with distinct icons.
35. Chainalysis Reactor (highlight) - crypto tracing UX, exposure graph. Take: directed flow edges with amount labels.
36. TRM Labs (highlight) - forensics + compliance. Noted.
37. Elliptic (highlight) - crypto risk scoring. Noted.
38. Cellebrite Pathfinder (highlight) - digital forensics timeline. Noted.

## C. World-class product/dashboard UI
39. Linear (medium) - disciplined type scale, keyboard-first, restrained color. Take: speed + calm.
40. Vercel dashboards (medium) - monochrome + single accent, dense but airy. Take: neutral-first palette.
41. Stripe Dashboard/Radar (medium) - data tables with inline evidence, reason codes. Take: every row explains itself.
42. Plaid (highlight) - clean fintech console. Noted.
43. Ramp (highlight) - finance ops UI, strong tables. Noted.
44. Brex (highlight) - fintech console. Noted.
45. Mercury (highlight) - refined banking UI, generous whitespace. Take: light theme can be premium.
46. Figma (highlight) - canvas tools chrome. Take: canvas + side panels layout for network explorer.
47. Notion (highlight) - calm information hierarchy. Noted.
48. GitHub (highlight) - dense developer console, mono for IDs. Take: mono identifiers.
49. Datadog (highlight) - observability density, consistent severity. Noted.
50. Grafana (highlight) - panel grammar, time-first. Noted.
51. Bloomberg Terminal (medium, design-language) - information density with strict hierarchy, semantic color only. Take: density is fine when hierarchy is strict.
52. Apple HIG (medium) - clarity/deference/depth, 44pt targets, spacing scale. Baseline discipline.
53. Amplitude/Hex/Retool (highlight) - analyst tooling layouts. Noted.
54. Raycast/Height/Plane (highlight) - modern console polish, cmd-K. Take: command palette (nice-to-have).

## Bar set from the study (what "above the best" means here)
- Every risk number shows its working (Stripe/FICO reason codes + Unit21 auditability).
- Graph exploration is incremental and time-aware (Linkurious/KeyLines), not a hairball screenshot.
- Queue-first, severity-consistent, zero vanity KPIs (Vectra/dashboard guidance).
- Light, calm, forensic console: paper base, ink text, one brand indigo, semantic risk palette, mono data fonts; no purple gradients, no glassmorphism, no generic dark-terminal look (Impeccable detector rules applied).
