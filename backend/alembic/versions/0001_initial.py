"""initial schema (SRS section 6)

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-25
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'datasets',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('source_type', sa.String(32), nullable=False),
        sa.Column('provenance', sa.String(255), nullable=False, server_default='user-upload'),
        sa.Column('checksum', sa.String(64), nullable=False),
        sa.Column('schema_version', sa.String(32), nullable=False, server_default='portal-aligned-v1'),
        sa.Column('currency', sa.String(8), nullable=False, server_default='INR'),
        sa.Column('status', sa.String(32), nullable=False, server_default='imported'),
        sa.Column('row_counts_json', sa.Text, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        'import_batches',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('dataset_id', sa.String(36), sa.ForeignKey('datasets.id'), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('checksum', sa.String(64), nullable=False),
        sa.Column('original_headers_json', sa.Text, nullable=False, server_default='[]'),
        sa.Column('column_mapping_json', sa.Text, nullable=False, server_default='{}'),
        sa.Column('imported_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('accepted_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('rejected_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('duplicate_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('status', sa.String(32), nullable=False, server_default='completed'),
    )
    op.create_index('ix_import_batches_dataset_id', 'import_batches', ['dataset_id'])
    op.create_table(
        'accounts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('dataset_id', sa.String(36), sa.ForeignKey('datasets.id'), nullable=False),
        sa.Column('external_account_ref', sa.String(255), nullable=False),
        sa.Column('role_seen', sa.String(16), nullable=False, server_default='both'),
        sa.Column('metadata_json', sa.Text, nullable=False, server_default='{}'),
    )
    op.create_index('ix_accounts_dataset_id', 'accounts', ['dataset_id'])
    op.create_index('ix_accounts_external_account_ref', 'accounts', ['external_account_ref'])
    op.create_table(
        'transactions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('dataset_id', sa.String(36), sa.ForeignKey('datasets.id'), nullable=False),
        sa.Column('batch_id', sa.String(36), sa.ForeignKey('import_batches.id'), nullable=False),
        sa.Column('external_txn_ref', sa.String(255), nullable=True),
        sa.Column('source_account_id', sa.String(36), sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('destination_account_id', sa.String(36), sa.ForeignKey('accounts.id'), nullable=True),
        sa.Column('amount', sa.Numeric(19, 4), nullable=False),
        sa.Column('currency', sa.String(8), nullable=False, server_default='INR'),
        sa.Column('ts', sa.DateTime(timezone=True), nullable=False),
        sa.Column('raw_row_ref', sa.Integer, nullable=False),
        sa.Column('fingerprint', sa.String(64), nullable=False),
        sa.Column('duplicate_of', sa.String(36), nullable=True),
    )
    op.create_index('ix_transactions_dataset_id', 'transactions', ['dataset_id'])
    op.create_index('ix_transactions_batch_id', 'transactions', ['batch_id'])
    op.create_index('ix_transactions_source_account_id', 'transactions', ['source_account_id'])
    op.create_index('ix_transactions_ts', 'transactions', ['ts'])
    op.create_index('ix_transactions_fingerprint', 'transactions', ['fingerprint'])
    op.create_table(
        'training_runs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('dataset_ids_json', sa.Text, nullable=False),
        sa.Column('dataset_checksums_json', sa.Text, nullable=False),
        sa.Column('algorithm', sa.String(64), nullable=False),
        sa.Column('feature_version', sa.String(32), nullable=False),
        sa.Column('parameters_json', sa.Text, nullable=False, server_default='{}'),
        sa.Column('metrics_json', sa.Text, nullable=False, server_default='{}'),
        sa.Column('artifact_path', sa.String(512), nullable=True),
        sa.Column('status', sa.String(32), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        'model_versions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('training_run_id', sa.String(36), sa.ForeignKey('training_runs.id'), nullable=False),
        sa.Column('artifact_path', sa.String(512), nullable=False),
        sa.Column('feature_version', sa.String(32), nullable=False),
        sa.Column('active', sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        'analysis_runs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('dataset_id', sa.String(36), sa.ForeignKey('datasets.id'), nullable=False),
        sa.Column('model_version_id', sa.String(36), sa.ForeignKey('model_versions.id'), nullable=True),
        sa.Column('status', sa.String(32), nullable=False, server_default='pending'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('summary_json', sa.Text, nullable=False, server_default='{}'),
    )
    op.create_index('ix_analysis_runs_dataset_id', 'analysis_runs', ['dataset_id'])
    op.create_table(
        'account_assessments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('analysis_run_id', sa.String(36), sa.ForeignKey('analysis_runs.id'), nullable=False),
        sa.Column('account_id', sa.String(36), sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('score', sa.Numeric(6, 2), nullable=False),
        sa.Column('band', sa.String(16), nullable=False),
        sa.Column('method', sa.String(64), nullable=False),
        sa.Column('indicators_json', sa.Text, nullable=False, server_default='[]'),
        sa.Column('warnings_json', sa.Text, nullable=False, server_default='[]'),
    )
    op.create_index('ix_account_assessments_run', 'account_assessments', ['analysis_run_id'])
    op.create_index('ix_account_assessments_account', 'account_assessments', ['account_id'])
    op.create_table(
        'findings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('analysis_run_id', sa.String(36), sa.ForeignKey('analysis_runs.id'), nullable=False),
        sa.Column('type', sa.String(64), nullable=False),
        sa.Column('severity', sa.String(16), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('explanation', sa.Text, nullable=False, server_default=''),
        sa.Column('status', sa.String(32), nullable=False, server_default='open'),
        sa.Column('evidence_refs_json', sa.Text, nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_findings_run', 'findings', ['analysis_run_id'])
    op.create_table(
        'analyst_notes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('finding_id', sa.String(36), sa.ForeignKey('findings.id'), nullable=False),
        sa.Column('note', sa.Text, nullable=False),
        sa.Column('actor_ref', sa.String(64), nullable=False, server_default='local-session'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_analyst_notes_finding', 'analyst_notes', ['finding_id'])
    op.create_table(
        'audit_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('actor_ref', sa.String(64), nullable=False, server_default='local-session'),
        sa.Column('action', sa.String(64), nullable=False),
        sa.Column('target_type', sa.String(64), nullable=False),
        sa.Column('target_id', sa.String(64), nullable=False),
        sa.Column('ts', sa.DateTime(timezone=True), nullable=False),
        sa.Column('metadata_json', sa.Text, nullable=False, server_default='{}'),
    )


def downgrade() -> None:
    for t in ('audit_events', 'analyst_notes', 'findings', 'account_assessments',
              'analysis_runs', 'model_versions', 'training_runs', 'transactions',
              'accounts', 'import_batches', 'datasets'):
        op.drop_table(t)
