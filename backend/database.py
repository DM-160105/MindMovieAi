import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ─── PostgreSQL Connection ─────────────────────────────────────────────────────
# Format: postgresql://user:password@host:port/database
# Reads from environment variable DATABASE_URL, falls back to local default
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://devang-makwana@localhost:5432/stremflix"
)

# PostgreSQL does NOT need check_same_thread
engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
