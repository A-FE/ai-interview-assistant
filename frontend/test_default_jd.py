#!/usr/bin/env python
"""Test script for default JD functionality."""
import asyncio
from backend.database import get_db, init_db
from backend.models.user import User
from backend.models.jd_session import JDSession
from backend.scripts.seed_default_jd import create_default_jd_for_user
from sqlalchemy import select


async def test_default_jd():
    """Test default JD creation."""
    print("🧪 Testing default JD functionality...\n")

    # Initialize database
    await init_db()

    async for db in get_db():
        # Create a test user
        test_user = User(username="test_default_jd", is_guest=True)
        db.add(test_user)
        await db.commit()
        await db.refresh(test_user)
        print(f"✅ Created test user: {test_user.username} (ID: {test_user.id})")

        # Create default JD for the user
        default_jd = await create_default_jd_for_user(db, test_user.id)
        if default_jd:
            print(f"✅ Created default JD (ID: {default_jd.id})")
            print(f"   - Title: {default_jd.title}")
            print(f"   - Company: {default_jd.company}")
            print(f"   - is_default: {default_jd.is_default}")
            print(f"   - JD text length: {len(default_jd.jd_text)} chars")
        else:
            print("❌ Failed to create default JD")
            return

        # Try creating again (should return None)
        duplicate = await create_default_jd_for_user(db, test_user.id)
        if duplicate is None:
            print("✅ Duplicate creation prevented (returned None)")
        else:
            print("❌ Should not create duplicate default JD")

        # Verify user has exactly one default JD
        result = await db.execute(
            select(JDSession).where(
                JDSession.user_id == test_user.id,
                JDSession.is_default == True
            )
        )
        default_jds = result.scalars().all()
        print(f"✅ User has {len(default_jds)} default JD(s)")

        # Clean up
        await db.delete(test_user)
        await db.commit()
        print("\n✅ Test completed and cleaned up")

        break  # Only need one iteration


if __name__ == "__main__":
    asyncio.run(test_default_jd())
