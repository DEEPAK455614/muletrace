"""ORM models. Logical tables per SRS section 6. Money as NUMERIC, timestamps UTC."""
from datetime import datetime, timezone

from sqlalchemy import (Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Dataset(Base):
    __tablename__ = 'datasets'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(String(32))  # historical | current
    provenance: Mapped[str] = mapped_column(String(255), default='user-upload')
    checksum: Mapped[str] = mapped_column(String(64))
    schema_version: Mapped[str] = mapped_column(String(32), default='portal-aligned-v1')
    currency: Mapped[str] = mapped_column(String(8), default='INR')
    status: Mapped[str] = mapped_column(String(32), default='imported')
    row_counts_json: Mapped[str] = mapped_column(Text, default='{}')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ImportBatch(Base):
    __tablename__ = 'import_batches'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(ForeignKey('datasets.id'), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    checksum: Mapped[str] = mapped_column(String(64))
    original_headers_json: Mapped[str] = mapped_column(Text, default='[]')
    column_mapping_json: Mapped[str] = mapped_column(Text, default='{}')
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    accepted_count: Mapped[int] = mapped_column(Integer, default=0)
    rejected_count: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default='completed')


class Account(Base):
    __tablename__ = 'accounts'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(ForeignKey('datasets.id'), index=True)
    external_account_ref: Mapped[str] = mapped_column(String(255), index=True)
    role_seen: Mapped[str] = mapped_column(String(16), default='both')  # debit | credit | both
    metadata_json: Mapped[str] = mapped_column(Text, default='{}')


class Transaction(Base):
    __tablename__ = 'transactions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(ForeignKey('datasets.id'), index=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey('import_batches.id'), index=True)
    external_txn_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_account_id: Mapped[str] = mapped_column(ForeignKey('accounts.id'), index=True)
    destination_account_id: Mapped[str | None] = mapped_column(ForeignKey('accounts.id'), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(19, 4))
    currency: Mapped[str] = mapped_column(String(8), default='INR')
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    raw_row_ref: Mapped[int] = mapped_column(Integer)  # source CSV row number (1-based, header excluded)
    fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    duplicate_of: Mapped[str | None] = mapped_column(String(36), nullable=True)


class TrainingRun(Base):
    __tablename__ = 'training_runs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    dataset_ids_json: Mapped[str] = mapped_column(Text)
    dataset_checksums_json: Mapped[str] = mapped_column(Text)
    algorithm: Mapped[str] = mapped_column(String(64))
    feature_version: Mapped[str] = mapped_column(String(32))
    parameters_json: Mapped[str] = mapped_column(Text, default='{}')
    metrics_json: Mapped[str] = mapped_column(Text, default='{}')
    artifact_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default='pending')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ModelVersion(Base):
    __tablename__ = 'model_versions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    training_run_id: Mapped[str] = mapped_column(ForeignKey('training_runs.id'))
    artifact_path: Mapped[str] = mapped_column(String(512))
    feature_version: Mapped[str] = mapped_column(String(32))
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AnalysisRun(Base):
    __tablename__ = 'analysis_runs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(ForeignKey('datasets.id'), index=True)
    model_version_id: Mapped[str | None] = mapped_column(ForeignKey('model_versions.id'), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default='pending')
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    summary_json: Mapped[str] = mapped_column(Text, default='{}')


class AccountAssessment(Base):
    __tablename__ = 'account_assessments'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    analysis_run_id: Mapped[str] = mapped_column(ForeignKey('analysis_runs.id'), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey('accounts.id'), index=True)
    score: Mapped[float] = mapped_column(Numeric(6, 2))
    band: Mapped[str] = mapped_column(String(16))
    method: Mapped[str] = mapped_column(String(64))
    indicators_json: Mapped[str] = mapped_column(Text, default='[]')
    warnings_json: Mapped[str] = mapped_column(Text, default='[]')


class Finding(Base):
    __tablename__ = 'findings'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    analysis_run_id: Mapped[str] = mapped_column(ForeignKey('analysis_runs.id'), index=True)
    type: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(255))
    explanation: Mapped[str] = mapped_column(Text, default='')
    status: Mapped[str] = mapped_column(String(32), default='open')
    evidence_refs_json: Mapped[str] = mapped_column(Text, default='[]')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AnalystNote(Base):
    __tablename__ = 'analyst_notes'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    finding_id: Mapped[str] = mapped_column(ForeignKey('findings.id'), index=True)
    note: Mapped[str] = mapped_column(Text)
    actor_ref: Mapped[str] = mapped_column(String(64), default='local-session')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditEvent(Base):
    __tablename__ = 'audit_events'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    actor_ref: Mapped[str] = mapped_column(String(64), default='local-session')
    action: Mapped[str] = mapped_column(String(64))
    target_type: Mapped[str] = mapped_column(String(64))
    target_id: Mapped[str] = mapped_column(String(64))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    metadata_json: Mapped[str] = mapped_column(Text, default='{}')
