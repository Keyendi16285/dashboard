from fastapi import FastAPI, Depends, HTTPException, Response, status, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlmodel import Session, select, func
from sqlalchemy import text
from typing import List, Optional
import os
from dotenv import load_dotenv

# Import database and model definitions
from database import get_session, create_db_and_tables
from models import Defendant, CaseEntry, ActivityLog, LitigationStatus
from access import load_access, reject_if_archived

load_dotenv()

# --- AUTHENTICATION (Shared Case Tracker SSO) ---
SECRET_KEY = os.getenv("SECRET_KEY")
SECRET_KEY_PREVIOUS = os.getenv("SECRET_KEY_PREVIOUS")  # optional: accept prior key during rotation
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set — refusing to start without a JWT signing key.")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")  # Points to Case Tracker login


def _decode_token(token: str) -> dict:
    """Decode a JWT, accepting the current or (during rotation) previous key."""
    for key in (SECRET_KEY, SECRET_KEY_PREVIOUS):
        if not key:
            continue
        try:
            return jwt.decode(token, key, algorithms=[ALGORITHM])
        except Exception:
            continue
    raise ValueError("Token could not be validated with any configured key")


async def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)):
    """Validates the Case Tracker-issued JWT attached as a Bearer token."""
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = _decode_token(token)
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception
    # Archived/inactive accounts and revoked (stale-version) tokens are denied
    # immediately, not just on token expiry.
    reject_if_archived(session, username, payload.get("tv", 0))
    return username


def _is_admin(session, username) -> bool:
    """TST (test) cases are admin-only. Look up is_admin for the current user
    in the shared case_management `user` table."""
    if not username:
        return False
    try:
        row = session.execute(
            text('SELECT is_admin FROM "user" WHERE username = :u'),
            {"u": username},
        ).first()
        return bool(row[0]) if row else False
    except Exception:
        return False

app = FastAPI(title="MassFOIA Defendant Dashboard")

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse("static/index.html")

@app.get("/defendants")
async def read_defendants_dashboard():
    return FileResponse("static/defendants.html")

@app.get('/favicon.ico', include_in_schema=False)
async def favicon():
    # Path where it expects the icon
    primary_favicon = "static/favicon.ico"
    fallback_favicon = "static/favicon.png"
    
    # Safely check if the .ico file exists
    if os.path.exists(primary_favicon):
        return FileResponse(primary_favicon)
    # If not, check if your .png version exists
    elif os.path.exists(fallback_favicon):
        return FileResponse(fallback_favicon)
    
    # If nothing exists, return an empty 204 response so it doesn't crash
    return Response(status_code=204)

# --- API ROUTES ---

@app.get("/api/defendants", response_model=List[dict])
def get_dashboard_defendants(
    case_class: str = None,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """
    Simplified database fetch focusing only on Defendants and CaseEntries.
    """
    try:
        # 1. Define the Join Statement
        # We join on case_id to link defendants to their parent case
        statement = select(Defendant, CaseEntry).join(
            CaseEntry, Defendant.case_id == CaseEntry.id
        )

        # 2. Apply Filtering Logic
        # Mirroring Returnalyzer logic to exclude Test cases by default[cite: 3]
        if case_class and case_class != "ALL":
            statement = statement.where(CaseEntry.case_class == case_class)
        # Access control: tool gate + TST-admin-only + scope (case + defendant-level).
        ctx = load_access(session, user)
        statement = ctx.filter_defendants(ctx.filter_cases(statement))

        # 3. Execute Query
        results = session.exec(statement).all()

        # Compact "latest activity" per defendant for the registry rows.
        status_map = _load_litigation_status_map(session)
        latest = _latest_activity_map(
            session, ActivityLog.defendant_id, [d.id for d, _ in results]
        )

        # 4. Format Output for Frontend
        # We map the SQLModel objects to a plain dictionary for the JSON response
        output = []
        for def_obj, case_obj in results:
            output.append({
                "id": def_obj.id,
                "name": def_obj.name,
                "case_number": case_obj.case_number,
                "case_name": case_obj.case_name,
                "case_class": case_obj.case_class,
                "last_activity": _activity_summary(latest.get(def_obj.id), status_map)
            })

        return output

    except Exception as e:
        # Log the error to the console for debugging
        print(f"Database Error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")
    
@app.get("/defendants/{defendant_id}", response_class=HTMLResponse)
async def read_defendant_profile(request: Request, defendant_id: int):
    """
    Serves the static profile HTML page structure.
    Client-side JavaScript will handle fetching data using the ID in the URL.
    """
    file_path = os.path.join("static", "defendant_profile.html")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Profile template not found")
        
    with open(file_path, "r") as f:
        return HTMLResponse(content=f.read())
    
@app.get("/api/defendants/{defendant_id}")
async def get_defendant_data_api(
    defendant_id: int,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """
    API endpoint that queries the PostgreSQL DB and returns the single defendant object.
    """
    defendant = session.exec(select(Defendant).filter(Defendant.id == defendant_id)).first()
    
    if not defendant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Defendant with ID {defendant_id} not found."
        )
        
    # Return the fields your UI demands
    return {
        "id": defendant.id,
        "name": defendant.name,
        "case_name": getattr(defendant, "case_name", "N/A"),       # Fallback safety if column name differs
        "case_number": getattr(defendant, "case_number", "2025CH6") # Matches image screenshot pattern
    }
    
@app.get("/cases", response_class=HTMLResponse)
async def serve_cases_directory(request: Request):
    """Serves the central table directory view tracking master legal contexts."""
    with open(os.path.join("static", "cases.html"), "r") as f:
        return HTMLResponse(content=f.read())

@app.get("/cases/{case_id}", response_class=HTMLResponse)
async def serve_single_case_profile(request: Request, case_id: int):
    """Serves the template skeleton profile interface structure of a case."""
    with open(os.path.join("static", "case_profile.html"), "r") as f:
        return HTMLResponse(content=f.read())
    
@app.get("/api/cases")
async def get_all_cases_api(case_class: str = None, session: Session = Depends(get_session), user = Depends(get_current_user)):
    """Returns active case rows for the registry grid. Test (TST) cases are visible to admins only; non-admins never see them."""
    statement = select(CaseEntry)
    if case_class and case_class != "ALL":
        statement = statement.where(CaseEntry.case_class == case_class)
    # Access control: tool gate + TST-admin-only + this account's scope.
    statement = load_access(session, user).filter_cases(statement)
    cases = session.exec(statement).all()

    # Compact "latest activity" per case (case + its defendants) for registry rows.
    status_map = _load_litigation_status_map(session)
    latest = _latest_activity_map(session, ActivityLog.case_id, [c.id for c in cases])

    return [
        {
            "id": c.id,
            "case_name": c.case_name,
            "case_number": c.case_number,
            "defendant_name": getattr(c, "defendant_name", "N/A"), # Dynamic safety validation fallback
            "last_activity": _activity_summary(latest.get(c.id), status_map)
        } for c in cases
    ]

@app.get("/api/cases/{case_id}")
async def get_single_case_data_api(case_id: int, session: Session = Depends(get_session), user = Depends(get_current_user)):
    """Returns explicit target parameter model keys for parsing in profile landing sheets."""
    case_record = session.exec(select(CaseEntry).filter(CaseEntry.id == case_id)).first()
    if not case_record:
        raise HTTPException(status_code=404, detail="Requested litigation context node missing.")
    return {
        "id": case_record.id,
        "case_name": case_record.case_name,
        "case_number": case_record.case_number
    }

# --- ACTIVITY LOGS (read-only view of the shared activity_logs table) ---

def _load_litigation_status_map(session: Session) -> dict:
    """{ "3": "Complaint Filed", ... } from the shared litigation-status table."""
    try:
        rows = session.exec(select(LitigationStatus)).all()
        return {str(r.id): r.status for r in rows}
    except Exception as e:
        print(f"Litigation status map load failed: {e}")
        return {}


def _is_litigation_status_field(field_name: Optional[str]) -> bool:
    if not field_name:
        return False
    return field_name.strip().lower().replace("_", " ") in {"litigation status", "litigation status id"}


def _serialize_activity(log: ActivityLog, status_map: dict) -> dict:
    """Serialize an ActivityLog for the frontend, mapping litigation status ids
    to their human-readable names (e.g. "3 → 5" becomes
    "Complaint Filed → Served") and rebuilding the label to match."""
    old_value, new_value, label = log.old_value, log.new_value, log.label

    if _is_litigation_status_field(log.field_name):
        if old_value is not None:
            old_value = status_map.get(str(old_value).strip(), old_value)
        if new_value is not None:
            new_value = status_map.get(str(new_value).strip(), new_value)
        field = log.field_name or "Litigation Status"
        label = f"{field}: {old_value or 'None'} → {new_value or 'None'}"

    return {
        "id": log.id,
        "timestamp": log.timestamp,
        "entity_type": log.entity_type,
        "action": log.action,
        "user_initial": log.user_initial,
        "case_id": log.case_id,
        "defendant_id": log.defendant_id,
        "case_name": log.case_name,
        "defendant_name": log.defendant_name,
        "field_name": log.field_name,
        "old_value": old_value,
        "new_value": new_value,
        "label": label,
    }


def _activity_summary(log: Optional[ActivityLog], status_map: dict) -> Optional[dict]:
    """Compact one-line summary of a single activity row for registry rows."""
    if log is None:
        return None
    full = _serialize_activity(log, status_map)
    return {
        "label": full["label"],
        "action": full["action"],
        "user_initial": full["user_initial"],
        "timestamp": full["timestamp"],
    }


def _latest_activity_map(session: Session, column, ids: list) -> dict:
    """Return {entity_id: newest ActivityLog} for the given id column
    (ActivityLog.case_id or ActivityLog.defendant_id), in one round trip."""
    ids = [i for i in ids if i is not None]
    if not ids:
        return {}

    # Newest timestamp per entity id.
    newest = (
        select(column, func.max(ActivityLog.timestamp).label("ts"))
        .where(column.in_(ids))
        .group_by(column)
        .subquery()
    )
    rows = session.exec(
        select(ActivityLog).join(
            newest,
            (column == newest.c[column.key]) & (ActivityLog.timestamp == newest.c.ts),
        )
    ).all()

    result: dict = {}
    for r in rows:
        key = getattr(r, column.key)
        prev = result.get(key)
        # On a timestamp tie, keep the higher id (the later insert).
        if prev is None or (r.id or 0) > (prev.id or 0):
            result[key] = r
    return result


@app.get("/api/cases/{case_id}/activity")
def get_case_activity(
    case_id: int,
    limit: int = 200,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Case-level activity feed: the case's own changes AND all of its
    defendants' changes (defendant rows are logged with this case_id too),
    newest first."""
    logs = session.exec(
        select(ActivityLog)
        .where(ActivityLog.case_id == case_id)
        .order_by(ActivityLog.timestamp.desc())
        .limit(limit)
    ).all()
    status_map = _load_litigation_status_map(session)
    return [_serialize_activity(log, status_map) for log in logs]

@app.get("/api/defendants/{defendant_id}/activity")
def get_defendant_activity(
    defendant_id: int,
    limit: int = 200,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    """Defendant-level activity feed: only this defendant's changes, newest first."""
    logs = session.exec(
        select(ActivityLog)
        .where(ActivityLog.defendant_id == defendant_id)
        .order_by(ActivityLog.timestamp.desc())
        .limit(limit)
    ).all()
    status_map = _load_litigation_status_map(session)
    return [_serialize_activity(log, status_map) for log in logs]