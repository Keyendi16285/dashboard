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


class LitigationStatus(SQLModel, table=True):
    """Shared lookup (case_management DB): maps a litigation status id to its
    human-readable name (e.g. 3 -> "Complaint Filed"). Read-only here; used to
    turn raw status ids in the activity feed into names."""
    __tablename__ = "litigation-status"
    id: int = Field(primary_key=True)
    status: str


class ActivityLog(SQLModel, table=True):
    """Shared activity feed written by Case Tracker (case_management DB).

    The dashboard READS this table to render case- and defendant-level history;
    it never writes to it. Schema mirrors case-entry-form's models/activity.py so
    the shared table is used as-is (no separate/duplicate log table).

    A defendant change is logged with BOTH case_id and defendant_id, so filtering
    by case_id yields the full case timeline (case + its defendants), while
    filtering by defendant_id yields just that defendant.
    """
    __tablename__ = "activity_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)

    # Who & what
    entity_type: str            # "CASE" | "DEFENDANT"
    action: str                 # "CREATE" | "UPDATE" | "DELETE"
    user_initial: str

    # Entity references
    case_id: Optional[int] = Field(default=None, index=True)
    defendant_id: Optional[int] = Field(default=None, index=True)

    # Denormalized display snapshots (avoids joins on read)
    case_name: Optional[str] = None
    defendant_name: Optional[str] = None

    # Structured change data (one row per field)
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None

    # Human-readable summary
    label: Optional[str] = None