from datetime import datetime, timedelta
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt as _bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.database import get_db
from backend.models.user import User
from backend.schemas import UserRegister, UserLogin, TokenResponse
from backend.scripts.seed_default_jd import create_default_jd_for_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


@router.post("/register", response_model=TokenResponse)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        is_guest=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create default JD for new user
    try:
        await create_default_jd_for_user(db, user.id)
    except Exception as e:
        # Log error but don't block registration
        print(f"Failed to create default JD for user {user.id}: {e}")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token, user_id=user.id,
        username=user.username, is_guest=False,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or user.is_guest or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    # Create default JD for user if they don't have one yet
    try:
        await create_default_jd_for_user(db, user.id)
    except Exception as e:
        # Log error but don't block login
        print(f"Failed to create default JD for user {user.id}: {e}")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token, user_id=user.id,
        username=user.username, is_guest=False,
    )


@router.post("/guest", response_model=TokenResponse)
async def guest_login(db: AsyncSession = Depends(get_db)):
    """Create a temporary guest account."""
    guest_name = f"guest_{uuid.uuid4().hex[:8]}"
    user = User(username=guest_name, is_guest=True)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create default JD for guest user
    try:
        await create_default_jd_for_user(db, user.id)
    except Exception as e:
        # Log error but don't block guest login
        print(f"Failed to create default JD for guest {user.id}: {e}")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token, user_id=user.id,
        username=user.username, is_guest=True,
    )
