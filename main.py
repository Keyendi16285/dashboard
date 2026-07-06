from fastapi import FastAPI, Depends, HTTPException, Response, status, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlmodel import Session, select, func
from sqlalchemy import text
from typing import List
import os
from dotenv import load_dotenv

# Import database and model definitions
from database import get_session, create_db_and_tables
from models import Defendant, CaseEntry

load_dotenv()

# --- AUTHENTICATION (Shared Case Tracker SSO) ---
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")  # Points to Case Tracker login


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Validates the Case Tracker-issued JWT attached as a Bearer token."""
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except JWTError:
        raise credentials_exception


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
        # TST is admin-only: non-admins never see it, even via an explicit filter.
        if not _is_admin(session, user):
            statement = statement.where(func.upper(func.trim(func.coalesce(CaseEntry.case_class, ""))) != "TST")

        # 3. Execute Query
        results = session.exec(statement).all()

        # 4. Format Output for Frontend
        # We map the SQLModel objects to a plain dictionary for the JSON response
        output = []
        for def_obj, case_obj in results:
            output.append({
                "id": def_obj.id,
                "name": def_obj.name,
                "case_number": case_obj.case_number,
                "case_name": case_obj.case_name,
                "case_class": case_obj.case_class
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
    # TST is admin-only: non-admins never see it, even via an explicit filter.
    if not _is_admin(session, user):
        statement = statement.where(func.upper(func.trim(func.coalesce(CaseEntry.case_class, ""))) != "TST")
    cases = session.exec(statement).all()
    return [
        {
            "id": c.id,
            "case_name": c.case_name,
            "case_number": c.case_number,
            "defendant_name": getattr(c, "defendant_name", "N/A") # Dynamic safety validation fallback
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