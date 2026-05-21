from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from typing import List
import os
from dotenv import load_dotenv

# Import database and model definitions
from database import get_session, create_db_and_tables
from models import Defendant, CaseEntry

load_dotenv()

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
    session: Session = Depends(get_session)
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
        if not case_class or case_class == "ALL":
            statement = statement.where(CaseEntry.case_class != "TST")
        else:
            statement = statement.where(CaseEntry.case_class == case_class)
        
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