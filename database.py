from sqlmodel import create_engine, SQLModel, Session
import os 
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Pull from .env if available, otherwise use the Returnalyzer default
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:casemanagement@db:5432/case_management")

engine = create_engine(DATABASE_URL, echo=True)

def create_db_and_tables():
    """Initializes tables if they don't exist."""
    SQLModel.metadata.create_all(engine)

def get_session():
    """Dependency for FastAPI routes to handle DB transactions[cite: 5]."""
    with Session(engine) as session:
        yield session