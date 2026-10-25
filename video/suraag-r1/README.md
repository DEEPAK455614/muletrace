# Suraag short walkthrough, revision 1

Requested 25 October 2026: approximately three minutes explaining the current build. This is a short private review video, not the hackathon's separate 8-10 minute submission video. No submission or organizer sharing has been performed.

Recorded against workbench 9dadf79 with displayed branding updated to Suraag. Repository identity and production deployment are unchanged. Backend runs locally on port8000 and UI on5173. The online preview is frontend-only.

## Contents and mode boundaries
1. Product overview and synthetic-data limits.
2. Backend CSV validation, mapping, import and registered datasets.
3. Historical logistic-model training with random-split/transductive limits.
4. Persisted current-data analysis, model/rules scoring and provenance.
5. Stored-transaction trace, findings, analyst notes and PDF export.
6. Separate browser-demo workbench: graph selection, account/rule/model evidence, timeline, complaint correlation, browser-local triage audit.
7. Evaluation, methodology, themes and local-only/production limits.

The browser demo's complaints, graph and audit are NOT claimed to be driven by the uploaded backend investigation. The narration and chapter banner make the change of mode explicit. All data shown is generated synthetic data, not real bank records or personal team information.

## Reproduction
Run the repo README setup. Then `python3 video/suraag-r1/make-fixtures.py` creates labelled synthetic history and current CSV. Copy the historical source into data/historical as generated before training, because training locates originals there by checksum. Launch the UI and backend, then use the guided screens or record.mjs for the demonstrated actions. Recording script expects local ports8000/5173, puppeteer-core and Chrome. Narration text is in narration/ and the supplied audio in the separate media archive.

No paid media, music, third-party accounts or external services were added. Source recordings are real UI captures; explanatory holds are not presented as new live actions. Exported PDF comes from the persisted run shown.

Measured final:193.243seconds,1920x1080 H.264/AAC. Full decode clean; chapter-boundary/frame seeking checked. Narration transcripts and levels inspected, but direct listening was unavailable so pronunciation/voice naturalness are not certified. See QA.json for details.
