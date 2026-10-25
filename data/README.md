# Data directories

- `historical/` - developer-provided, labelled historical training CSVs. Never commit real or confidential case data; this folder is gitignored except this README.
- `incoming/` - temporary uploads held only during validation/import. Gitignored.
- `processed/` - optional generated artefacts. Gitignored.

Portal-aligned minimum transaction columns (SRS section 7): transaction ID/UTR,
transaction date/time, fraud amount, debit bank/wallet/merchant, debit account/wallet/UPI ID.
Recipient-side columns are optional but required for multi-hop tracing; missing recipients are
warned about, never invented. One row = one transaction. Currency is a dataset-level import
setting (INR preselected), not a CSV column.
