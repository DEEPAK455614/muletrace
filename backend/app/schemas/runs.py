"""Request/response schemas for training and analysis (SRS section 8)."""
from pydantic import BaseModel, Field


class TrainingRequest(BaseModel):
    dataset_ids: list[str] = Field(min_length=1)
    algorithm: str = 'logistic_regression'
    parameters: dict = Field(default_factory=dict)


class AnalysisRequest(BaseModel):
    dataset_id: str
    model_version_id: str | None = None  # omitted -> active model if any, else rule baseline
    rule_thresholds: dict = Field(default_factory=dict)


class TraceRequest(BaseModel):
    account_ref: str
    direction: str = 'forward'  # forward | backward
    max_hops: int = Field(default=3, ge=1, le=10)
    min_amount: float | None = None
    since: str | None = None
    until: str | None = None


class FindingUpdate(BaseModel):
    status: str  # acknowledged | resolved | open


class AnalystNoteCreate(BaseModel):
    note: str = Field(min_length=1, max_length=4000)
