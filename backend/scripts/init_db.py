import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pymysql
from sqlalchemy import inspect
from config.settings import settings
from config.database import engine, Base
import models  # Registers all models with Base.metadata

def create_database_if_not_exists():
    """Connect to MySQL server directly and ensure the target database exists."""
    print(f"Connecting to MySQL server at {settings.MYSQL_HOST}:{settings.MYSQL_PORT}...")
    conn = pymysql.connect(
        host=settings.MYSQL_HOST,
        port=int(settings.MYSQL_PORT),
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        autocommit=True
    )
    with conn.cursor() as cursor:
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{settings.MYSQL_DATABASE}` "
            f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        )
        print(f"Database '{settings.MYSQL_DATABASE}' is ready.")
    conn.close()

def init_tables():
    """Create all tables defined in SQLAlchemy models."""
    create_database_if_not_exists()
    
    print("\nCreating all tables in SQLAlchemy metadata...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")

    print("\nVerifying database tables:")
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Found {len(tables)} tables in database '{settings.MYSQL_DATABASE}':")
    for t in sorted(tables):
        columns = inspector.get_columns(t)
        fks = inspector.get_foreign_keys(t)
        col_names = [col['name'] for col in columns]
        print(f" - {t} ({len(columns)} cols): {', '.join(col_names)}")
        for fk in fks:
            print(f"    |-- FK: {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")

if __name__ == "__main__":
    init_tables()
