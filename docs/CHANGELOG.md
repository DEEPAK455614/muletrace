# Changelog notes

## 24 Oct 2026 - commit 69e320b
Commit 69e320b ("Fit graph layouts to the viewBox and scale label size") contains two logical changes that were
staged together: (1) graph layout fit/legibility, and (2) content-fingerprint scoping for uploaded datasets
(triage/audit storage keys are `uploaded:<cyrb53(content)>`, not filename-based). The commit message names only
the first; this note records the second so reviewers are not misled. History was left as-is, not rewritten.
