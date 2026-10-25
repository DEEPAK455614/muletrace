from pydantic import BaseModel, Field


class ImportConfirm(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    mapping: dict[str, str]
    source_type: str = Field(pattern='^(historical|current)$')
    name: str = Field(min_length=1, max_length=255)
    currency: str = Field(default='INR', max_length=8)
