from datetime import date, datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship, true

class Defendant(SQLModel, table=True):
    __tablename__ = 'defendants'

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    number: int
    case_profile: Optional[str] = Field(default=None, nullable=True)
    complaint_date: Optional[date] = Field(default=None, nullable=True)
    paragraph_count: Optional[int] = Field(default=None, nullable=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Link back to the CaseEntry[cite: 6]
    case_id: int = Field(foreign_key="case-entries.id")
    case: "CaseEntry" = Relationship(back_populates="defendants")

    service_status: Optional[str] = Field(default="None")
    settlement_status: Optional[str] = Field(default="None")
    discovery_status: Optional[str] = Field(default="None")
    litigation_status_id: int = Field(default=3)
    settlement_amount: Optional[float] = Field(default=0.0, nullable=true, ge=0)

class CaseEntryBase(SQLModel):
    case_name: str
    case_number: Optional[str] = Field(default="None")
    case_class: str
    state: str
    county: str
    date_filed: date
    user_initial: str
    envelope_number: int = Field(ge=0)
    filing_fee_amount: float = Field(ge=0)
    plaintiff_entry: str
    defendant_entry: str
    type: str
    client_lead: str
    original_number_of_defendants: int = Field(gt=0)
    current_number_of_defendants: int = Field(gt=0)
    litigation_status_id: int
    filing_folder_url: str

class CaseEntry(CaseEntryBase, table=True):
    __tablename__ = 'case-entries'
    id: int | None = Field(default=None, primary_key=True)

    # Allows accessing defendants via case.defendants[cite: 6]
    defendants: List[Defendant] = Relationship(back_populates="case")