from fastapi import APIRouter, status, Depends, HTTPException, BackgroundTasks
from datetime import timedelta, datetime, timezone
from typing import Annotated
from pydantic import BaseModel, EmailStr
from ..database import db
from ..mail_config import fm
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError, ExpiredSignatureError
from fastapi_mail import MessageSchema, MessageType
from bson import ObjectId

router = APIRouter(
    tags=["/auth"],
    prefix="/auth"
)

SECRET_KEY = "920f066c1cebf8229949224928da7916f2b20c287e871ae135f79705c8fa6589"
ALGORITHM = "HS256"

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

async def authenticate_user(email: str, password: str):
    user = await db.users.find_one({"email": email})
    if not user:
        return False
    
    if not bcrypt_context.verify(password, user["hashed_password"]):
        return False
    
    return user


def create_token(email: str, user_id: str, expires_delta: timedelta):
    payload = {"sub": email, "id": user_id}
    expires = datetime.now(timezone.utc) + expires_delta
    payload.update({"exp": expires})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: Annotated[str, Depends(oauth2_bearer)]):
    if token is None:
        print("No token provided")
        raise HTTPException(status_code=401, detail="No token provided")
    
    try:
        print(f"Received token: {token[:20] if token else 'None'}...")  # Debug print
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        user_id = payload.get("id")

        if email is None or user_id is None:
            print(f"Token payload missing email or user_id: email={email}, user_id={user_id}")
            raise HTTPException(status_code=401, detail="Invalid token")

        # Verify user still exists in database
        user = await db.users.find_one({"email": email})
        if not user:
            print(f"User not found in database: {email}")
            raise HTTPException(status_code=401, detail="User not found")

        print(f"Successfully validated user: {email}")
        return {"email": email, "id": user_id}

    except ExpiredSignatureError:
        print("Token has expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError as e:
        print(f"JWT Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_user_from_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        user_id = payload.get("id")

        if not email or not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        return {"email": email, "id": user_id}

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/", status_code=201)
async def signup(formData: SignUp):
    existing_user = await db.users.find_one({"email": formData.email})

    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    new_user = {
        "name": formData.username,
        "email": formData.email,
        "hashed_password": bcrypt_context.hash(formData.password),
        "verified": False,
        "images": []
    }

    await db.users.insert_one(new_user)
    return {"message": "User created successfully"}

@router.post("/token", status_code=201)
async def login_for_access_token(form_Data: LogIn):
    user = await authenticate_user(form_Data.email, form_Data.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user["email"], str(user["_id"]), timedelta(minutes=20))
    return {"access_token": token, "token_type": "bearer"}

@router.post("/refresh_token", status_code=201)
async def login_for_refresh_token(form_Data: LogIn):
    user = await authenticate_user(form_Data.email, form_Data.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    refresh_token = create_token(user["email"], str(user["_id"]), timedelta(hours=2))
    return {"refresh_token": refresh_token}

@router.post("/generate_new_access_token", status_code=201)
async def generate_new_access_token(form_Data: RefreshToken):
    user_data = await get_user_from_token(form_Data.refresh_token)
    email = user_data["email"]

    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = create_token(user["email"], str(user["_id"]), timedelta(minutes=20))
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/forgot_password", status_code=200)
async def forgot_password(form_Data: SendMail, background_tasks: BackgroundTasks):
    user = await db.users.find_one({"email": form_Data.email})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    reset_token = create_token(user["email"], str(user["_id"]), timedelta(minutes=20))

    message = MessageSchema(
        subject="Password Reset Request",
        recipients=[form_Data.email],
        body=f"""
Click to reset password:
<a href="http://localhost:5173/reset_password/{reset_token}">Reset</a>
""",
        subtype=MessageType.html
    )

    background_tasks.add_task(fm.send_message, message)
    return {"message": f"Email sent to {form_Data.email}"}

@router.put("/reset_password/{reset_token}", status_code=200)
async def reset_password(reset_token: str, form_Data: ResetPassword):
    creds = await get_user_from_token(reset_token)
    email = creds["email"]

    await db.users.update_one(
        {"email": email},
        {"$set": {"hashed_password": bcrypt_context.hash(form_Data.password)}}
    )

    return {"message": "Password reset successful"}

@router.post("/verify_email", status_code=200)
async def verify_email(form_Data: SendMail, background_tasks: BackgroundTasks):
    user = await db.users.find_one({"email": form_Data.email})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    verify_token = create_token(user["email"], str(user["_id"]), timedelta(minutes=20))

    message = MessageSchema(
        subject="Verify Email",
        recipients=[form_Data.email],
        body=f"""
Click below to verify your email:
<a href="http://localhost:5173/verify_email/{verify_token}">Verify</a>
""",
        subtype=MessageType.html
    )

    background_tasks.add_task(fm.send_message, message)
    return {"message": f"Verification email sent to {form_Data.email}"}

@router.put("/verify_email/{verify_token}", status_code=200)
async def verify_email_token(verify_token: str):
    creds = await get_user_from_token(verify_token)
    email = creds["email"]

    await db.users.update_one(
        {"email": email},
        {"$set": {"verified": True}}
    )

    return {"message": "Email verified successfully"}
