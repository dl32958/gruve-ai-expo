from typing import Optional, Union
from pydantic import BaseModel, Field


class InvoiceFields(BaseModel):
    """
    Minimal extraction-stage schema for Engine B.

    This schema only enforces the structural contract of the extractor:
    - all expected fields exist
    - values may be string, int, float, or None

    Strict normalization and validation should happen in downstream shared modules.
    """

    company: Optional[Union[str, int, float]] = Field(default=None)
    date: Optional[Union[str, int, float]] = Field(default=None)
    address: Optional[Union[str, int, float]] = Field(default=None)
    total: Optional[Union[str, int, float]] = Field(default=None)


def validate_output(data: dict) -> InvoiceFields:
    """
    Validates and returns a typed InvoiceFields object.

    This function is intentionally lightweight at the extraction stage.
    It checks only that the output matches the expected field structure.
    Downstream modules should handle normalization, evidence retrieval,
    and validity rules.
    """
    return InvoiceFields(**data)