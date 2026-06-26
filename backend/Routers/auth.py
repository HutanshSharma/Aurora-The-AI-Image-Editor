import os
from fastapi import APIRouter, status, Depends, HTTPException, BackgroundTasks
from datetime import timedelta, datetime, timezone
from typing import Annotated
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from ..database import async_session, User
from ..mail_config import fm
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError, ExpiredSignatureError
from fastapi_mail import MessageSchema, MessageType

router = APIRouter(
    tags=["/auth"],
    prefix="/auth"
)
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
# Base URL of the frontend, used to build reset/verify links in emails.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

bcrypt_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_bearer = OAuth2PasswordBearer(tokenUrl="auth/token", auto_error=False)

class SignUp(BaseModel):
    username: str
    email: EmailStr
    password: str

class LogIn(BaseModel):
    email: EmailStr
    password: str

class SendMail(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    password: str

class RefreshToken(BaseModel):
    refresh_token: str


async def get_user_by_email(email: str):
    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()


async def authenticate_user(email: str, password: str):
    user = await get_user_by_email(email)
    if not user:
        return None

    if not bcrypt_context.verify(password, user.hashed_password):
        return None

    return user


def create_token(email: str, user_id: str, expires_delta: timedelta, token_type: str = "access"):
    payload = {"sub": email, "id": user_id, "type": token_type}
    expires = datetime.now(timezone.utc) + expires_delta
    payload.update({"exp": expires})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: Annotated[str, Depends(oauth2_bearer)]):
    if token is None:
        raise HTTPException(status_code=401, detail="No token provided")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        user_id = payload.get("id")

        if email is None or user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Reject non-access tokens (e.g. a refresh/reset token used as access).
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")

        # Verify user still exists in database
        user = await get_user_by_email(email)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return {"email": email, "id": user_id}

    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_user_from_token(token: str, expected_type: str = None):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        user_id = payload.get("id")

        if not email or not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        # When a specific token type is required, reject mismatches so a
        # refresh/reset/verify token can only be used for its intended flow.
        if expected_type is not None and payload.get("type") != expected_type:
            raise HTTPException(status_code=401, detail="Invalid token type")

        return {"email": email, "id": user_id}

    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/", status_code=201)
async def signup(formData: SignUp):
    existing_user = await get_user_by_email(formData.email)

    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    async with async_session() as session:
        new_user = User(
            name=formData.username,
            email=formData.email,
            hashed_password=bcrypt_context.hash(formData.password),
            verified=False,
        )
        session.add(new_user)
        await session.commit()

    return {"message": "User created successfully"}

@router.post("/token", status_code=201)
async def login_for_access_token(form_Data: LogIn):
    user = await authenticate_user(form_Data.email, form_Data.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user.email, str(user.id), timedelta(minutes=20))
    return {"access_token": token, "token_type": "bearer"}

@router.post("/refresh_token", status_code=201)
async def login_for_refresh_token(form_Data: LogIn):
    user = await authenticate_user(form_Data.email, form_Data.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    refresh_token = create_token(user.email, str(user.id), timedelta(hours=2), token_type="refresh")
    return {"refresh_token": refresh_token}

@router.post("/generate_new_access_token", status_code=201)
async def generate_new_access_token(form_Data: RefreshToken):
    user_data = await get_user_from_token(form_Data.refresh_token, expected_type="refresh")
    email = user_data["email"]

    user = await get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = create_token(user.email, str(user.id), timedelta(minutes=20))
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/forgot_password", status_code=200)
async def forgot_password(form_Data: SendMail, background_tasks: BackgroundTasks):
    user = await get_user_by_email(form_Data.email)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    reset_token = create_token(user.email, str(user.id), timedelta(minutes=20), token_type="reset")

    message = MessageSchema(
        subject="Password Reset Request",
        recipients=[form_Data.email],
        body=f"""
Click to reset password:
<a href="{FRONTEND_URL}/reset_password/{reset_token}">Reset</a>
""",
        subtype=MessageType.html
    )

    background_tasks.add_task(fm.send_message, message)
    return {"message": f"Email sent to {form_Data.email}"}

@router.put("/reset_password/{reset_token}", status_code=200)
async def reset_password(reset_token: str, form_Data: ResetPassword):
    creds = await get_user_from_token(reset_token, expected_type="reset")
    email = creds["email"]

    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.hashed_password = bcrypt_context.hash(form_Data.password)
        await session.commit()

    return {"message": "Password reset successful"}

@router.post("/verify_email", status_code=200)
async def verify_email(form_Data: SendMail, background_tasks: BackgroundTasks):
    user = await get_user_by_email(form_Data.email)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    verify_token = create_token(user.email, str(user.id), timedelta(minutes=20), token_type="verify")

    message = MessageSchema(
        subject="Verify Email",
        recipients=[form_Data.email],
        body=f"""
Click below to verify your email:
<a href="{FRONTEND_URL}/verify_email/{verify_token}">Verify</a>
""",
        subtype=MessageType.html
    )

    background_tasks.add_task(fm.send_message, message)
    return {"message": f"Verification email sent to {form_Data.email}"}

@router.put("/verify_email/{verify_token}", status_code=200)
async def verify_email_token(verify_token: str):
    creds = await get_user_from_token(verify_token, expected_type="verify")
    email = creds["email"]

    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.verified = True
        await session.commit()

    return {"message": "Email verified successfully"}
