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

## Round 2 - 24 Oct 2026, teammate reference video (PRAG-DRISHTI)
Reference: teammate's dark SOC "command intelligence center" demo video (1:52, phone capture).
Adopted: tamper-evident audit-trail concept -> implemented as SHA-256 hash-chained log of triage
status changes (browser-local, labeled demonstration-grade in UI).
Rejected: dark command-center theme (user asked for iOS-style light clarity), predictive
"next movement / predicted ATM" framing (conflicts with suspicion-not-guilt discipline),
decorative fraud map (geography is not in the risk model), case-compare matrix (lower value
than the existing queue workflow). No code copied; concept inspiration only.

---

# Round 3 - 24 Oct 2026, ~22:35 IST: sci-fi cyber-intelligence direction (user 22:33 voice)

User rejected the light iOS direction as too plain; wants a global-stage sci-fi
cyber-intelligence experience with purposeful animation, research-led. This round's
review was a targeted pass: 6 search sweeps produced the candidates below; notes come
from each source's public pages/case studies/snippets, depth honestly scaled to a
same-evening build window. Aspirational quality target only - no ranking claims.

## A. Financial-crime / crypto investigation tools (our exact domain)
1. Chainalysis Reactor (Behance case study) - node-graph investigation canvas, exposure coloring. TAKE: graph as the hero surface, edge direction weight. AVOID: dense pro-tool chrome everywhere.
2. Chainalysis Reactor "Exposure" (Behance) - in/out exposure visualization. TAKE: our trails page can use exposure-style terminal emphasis.
3. Chainalysis Reactor product page - investigation workflow framing. TAKE: case-first language.
4. Alanna Fischer - Chainalysis collaboration infra case study. TAKE: auditability as a first-class surface (we already have audit trail).
5. TRM Labs case studies - investigation narratives. TAKE: typology storytelling in Complaints.
6. Elliptic (Rob Squires rebuild) - dark fintech-investigation palette discipline. TAKE: restrained neon on near-black.
7. Recorded Future Attack Surface Intelligence dashboard - KPI + risk band hierarchy. TAKE: band color language.
8. Recorded Future Threat Intelligence product page - intel-card structure. TAKE: alert cards with confidence context.

## B. SOC / threat-intel dashboards
9. Figma Community Security Operations Dashboard - SOC layout grammar. TAKE: left-rail + dense-but-breathing grid.
10. Threat Intelligence Dashboard case study (designwithsarath.in) - alert triage flow. TAKE: severity-first queue.
11. Wandr Threat Intelligence Dashboard guide - practical density limits. AVOID: over-decorated panels.
12. Darkside Insights Dashboard - dark data-viz craft. TAKE: chart styling on dark.
13. Aegis SOC UI kit (Envato, reference only) - component inventory. AVOID: kit look.
14. rinjanianalytics/cti-platform-dashboard (GitHub) - open CTI layout. TAKE: feed/table rhythm.
15. CrowdStrike Foundry UI examples - enterprise module chrome. AVOID: enterprise clutter.
16. CrowdStrike Charlotte AI UX blog - conversational overlay on console. TAKE: command-bar future idea (not now).
17. Lab7 cybersecurity UI agency (Dribbble) - cyber visual language. TAKE: accent restraint.
18. Palantir (Dribbble) - Gotham-style ontology views. TAKE: entity linking presentation.

## C. Film FUI (sci-fi reference, the studios behind Oblivion/Tron/Blade Runner)
19. GMUNK Oblivion GFX - the benchmark for believable future consoles. TAKE: layered data, thin lines, glow on focal points only.
20. GMUNK Tron Board Room - geometric grid identity. TAKE: grid motif for our network canvas.
21. Territory Studio Blade Runner 2049 - atmospheric dark UI with amber accents. TAKE: amber/cyan duotone.
22. Territory Studio Ghost in the Shell - data-density + motion loops. TAKE: ambient background motion, slow.
23. Territory Studio Ex Machina - minimal lab interfaces. TAKE: typography-forward panels.
24. Territory Studio The Martian - mission telemetry readability. TAKE: numbers legible at glance.
25. Territory Studio Prometheus - ship consoles. TAKE: ring/radial motifs for score dial.
26. Perception RoboCop tech design - HUD restraint in real workflows. AVOID: decorative HUD clutter.
27. Perception FUI roundtable (Cineversity) - FUI principles: story-first, not decoration. GUIDING PRINCIPLE.
28. Territory Studio screen-graphics portfolio index - breadth. Reference only.

## D. Award-level dark web/data experiences
29. Awwwards Analytics Dashboard (Whispernode) - hero metric treatment. TAKE: oversized KPI type.
30. Awwwards Control-to-Analytics Flow (CryptoWL) - crypto console flow. TAKE: transition between control and analytics states.
31. Awwwards data-visualization websites index - benchmark list. Reference set.
32. Data Jungle real-time telemetry case study - streaming-data feel. TAKE: subtle tick/update animation on data.
33. Nexus Analytics (A'Design) - proactive insights cards. AVOID: busy gradients.
34. Awwwards Orage case study - cinematic dark launch page. TAKE: atmospheric depth (fog/glow layers).
35. Exaloop (Awwwards HM) - dev-tool dark polish. TAKE: code/data typography.
36. Multiuser Fluid (Awwwards HM) - motion smoothness bar. TAKE: easing discipline.

## E. Cyber maps / flow visualization
37. Cambridge Intelligence Wannacry visualization - flow-through-graph storytelling. TAKE: our trails = flow narrative.
38. Chainalysis-style exposure graph (Behance) - see #2.
39. cybermap-attack-globe (GitHub) - 3D globe arcs. AVOID: 3D globe (no map in our risk model; decorative).
40. Pulsemap (Kaan Gultekin) - live pulse aesthetics. TAKE: pulse on high-risk nodes.
41. hashplane map - grid-map abstraction. AVOID: geography (not in model).
42. xmcyber (JLE design) - attack-path visualization. TAKE: path highlighting through the graph.

## F. Mission-control / telemetry (NASA-grade clarity under pressure)
43. NASA Open MCT (ammos.nasa.gov) - open mission-control web UI. TAKE: dense telemetry grids that stay readable.
44. NASA NTRS telemetry display research - human-centered telemetry principles. TAKE: alarm hierarchy.
45. MoonRanger case study (laurenjpark.com) - modern mission console. TAKE: status strip design.
46. NASA mission-control redesign (space.com) - legacy-to-modern lessons. AVOID: wall-of-panels.
47. NASA Spinoff data-viz platform - operational dashboards. Reference.

## G. Premium dark product craft (motion/systems discipline)
48. Linear/Vercel/Stripe design-DNA analyses (dupe.design, opendesigner.io, mantlr.com) - how premium dark systems stay coherent. TAKE: token discipline, one accent, restrained motion.
49. DesignMD Linear-vs-Vercel motion study - minimal motion budgets. TAKE: animate state changes, not decorations.
50. Emil Kowalski design-eng skill (design-resources) - transform/opacity only, no animation on frequent actions, reduced-motion. RULE for all motion here.

## Synthesis -> art direction (codename NIGHTWATCH)
- Dark console: near-black blue base, glass panels, hairline cyan-tinted borders, subtle grid texture; glow only on focal/active elements (GMUNK restraint).
- Duotone accent: cyan (signal/intelligence) + amber (caution), red reserved for Critical, green for benign/cleared.
- The graph is the hero: d3-force network with directional flow particles (money movement), pulsing complaint-linked nodes, path highlighting on trails.
- Data typography: IBM Plex Mono for IDs, amounts, hashes; Space Grotesk display; count-up KPIs; staggered entrances; reduced-motion respected.
- Truthfulness stays: compact "Demo - Synthetic data" pill (dark-styled), suspicion-not-guilt cautions, frozen benchmark, audit trail. No predictive claims, no map, no fake live feeds.
