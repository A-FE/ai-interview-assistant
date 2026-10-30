#!/usr/bin/env python
"""
Database migration script: Add is_default field to jd_sessions table.

Run this once before starting the updated application:
    python migrate_add_is_default.py
"""
import asyncio
import sqlite3
from pathlib import Path


def migrate():
    """Add is_default column to jd_sessions table if it doesn't exist."""
    db_path = Path("jobprep.db")

    if not db_path.exists():
        print("✅ Database doesn't exist yet - will be created with schema on first run")
        return

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Check if column already exists
    cursor.execute("PRAGMA table_info(jd_sessions)")
    columns = [row[1] for row in cursor.fetchall()]

    if "is_default" in columns:
        print("✅ Column 'is_default' already exists - no migration needed")
        conn.close()
        return

    print("🔄 Adding 'is_default' column to jd_sessions table...")

    try:
        # Add the column with default value False
        cursor.execute("""
            ALTER TABLE jd_sessions
            ADD COLUMN is_default BOOLEAN DEFAULT 0
        """)

        # Create index on the new column
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS ix_jd_sessions_is_default
            ON jd_sessions (is_default)
        """)

        conn.commit()
        print("✅ Migration completed successfully")

    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        raise

    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
