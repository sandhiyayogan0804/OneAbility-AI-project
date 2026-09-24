from fastapi import APIRouter
from config.database import check_database_connection

router = APIRouter()

@router.get("/health")
def health_check():
    db_info = check_database_connection()
    return {
        "status": "ok" if db_info["connected"] else "degraded",
        "service": "OneAbility AI Backend Foundation",
        "database": {
            "status": "connected" if db_info["connected"] else "disconnected",
            "name": db_info["database"],
            "table_count": db_info["table_count"],
            "tables": db_info["tables"],
            "error": db_info["error"]
        }
    }

@router.get("/db/verify")
def verify_db_tables():
    db_info = check_database_connection()
    return {
        "status": "ok" if db_info["connected"] else "error",
        "database": db_info
    }
