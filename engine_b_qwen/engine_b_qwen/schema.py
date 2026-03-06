from typing import Optional
from pydantic import BaseModel, Field, validator
import re


class InvoiceFields(BaseModel):
    """
    Canonical output schema for Engine B (Qwen Extractor).

    All fields must exist.
    Missing values must be None.
    """

    company: Optional[str] = Field(default=None)
    date: Optional[str] = Field(default=None)
    address: Optional[str] = Field(default=None)
    total: Optional[str] = Field(default=None)

    @validator("date")
    def validate_date_format(cls, v):
        if v is None:
            return v
        # Accept DD/MM/YYYY only
        if not re.match(r"^\d{2}/\d{2}/\d{4}$", v):
            raise ValueError("Date must be in DD/MM/YYYY format")
        return v

    @validator("total")
    def validate_total_format(cls, v):
        if v is None:
            return v
        # Accept numeric string with 2 decimals
        if not re.match(r"^\d+(\.\d{2})$", v):
            raise ValueError("Total must be a numeric string with two decimals (e.g., '193.00')")
        return v


def validate_output(data: dict) -> InvoiceFields:
    """
    Validates and returns a strongly-typed InvoiceFields object.
    Raises validation error if schema is violated.
    """
    return InvoiceFields(**data)