from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from config.settings import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_recycle=3600,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI dependency to yield a database session per request."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_database_connection():
    """Utility to test the database connection and return table verification details."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            inspector = inspect(engine)
            tables = sorted(inspector.get_table_names())
            return {
                "connected": True,
                "database": settings.MYSQL_DATABASE,
                "tables": tables,
                "table_count": len(tables),
                "error": None
            }
    except Exception as exc:
        return {
            "connected": False,
            "database": settings.MYSQL_DATABASE,
            "tables": [],
            "table_count": 0,
            "error": str(exc)
        }

def get_db_connection():
    """Raw connection helper for legacy or direct connection checks."""
    try:
        return engine.raw_connection()
    except Exception:
        return None
