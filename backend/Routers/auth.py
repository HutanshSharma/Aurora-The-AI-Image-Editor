from fastapi import APIRouter,status, Depends, HTTPException, BackgroundTasks
from datetime import timedelta, datetime, timezone
from sqlalchemy.orm import Session
from typing import Annotated
from pydantic import BaseModel, EmailStr
from ..database import Sessionmaker
from ..models import Users
from ..mail_config import fm
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError, ExpiredSignatureError
from fastapi_mail import MessageSchema, MessageType

router = APIRouter(
    tags=['/auth'],
    prefix='/auth'
)

SECRET_KEY = '920f066c1cebf8229949224928da7916f2b20c287e871ae135f79705c8fa6589'
ALGORITHM = 'HS256'

bcrypt_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
oauth2_bearer = OAuth2PasswordBearer(tokenUrl='auth/token')

# pydantic models
class SignUp(BaseModel):
    username : str
    email : EmailStr
    password : str

class LogIn(BaseModel):
    email : EmailStr
    password : str

class SendMail(BaseModel):
    email : EmailStr

class ResetPassword(BaseModel):
    password : str

class RefreshToken(BaseModel):
    refresh_token :str


# utils
def get_db():
    db = Sessionmaker()
    try:
        yield db
    finally:
        db.close()

def authenticate_user(email:str, password:str, db):
    user = db.query(Users).filter(Users.email == email).first()
    if not user:
        return False
    if not bcrypt_context.verify(password,user.hashed_password):
        return False
    return user

def create_token(email:str, user_id:int, expires_delta: timedelta):
    payload = {'sub':email, 'id':user_id}
    expires = datetime.now(timezone.utc) + expires_delta
    payload.update({'exp':expires})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: Annotated[str, Depends(oauth2_bearer)]):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get('sub')
        user_id = payload.get('id')
        if email is None or user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not validate user")
        return {'email':email, 'id':user_id}
    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token has expired')
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not validate user")
    
async def get_user_from_token(token:str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get('sub')
        user_id = payload.get('id')
        if email is None or user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not validate user")
        return {'email':email, 'id':user_id}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not validate user")


# Dependencies
db_dependency = Annotated[Session, Depends(get_db)]
user_dependency = Annotated[dict, Depends(get_current_user)]


# routes
@router.post('/',status_code=status.HTTP_201_CREATED)
def signup(formData : SignUp, db: db_dependency):
    user = db.query(Users).filter(Users.email == formData.email).first()
    if user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='User with the same email id already exist')
    
    new_user = Users(
        name = formData.username,
        email = formData.email,
        hashed_password = bcrypt_context.hash(formData.password) 
    )
    db.add(new_user)
    db.commit()
    return 


@router.post('/token',status_code=status.HTTP_201_CREATED)
async def login_for_access_token(form_Data :LogIn,db: db_dependency):
    user = authenticate_user(form_Data.email, form_Data.password, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not validate user, check your credentials")
    token = create_token(user.email, user.id, timedelta(minutes=20))
    return {'access_token':token, "token_type":'bearer'}


@router.post('/refresh_token',status_code=status.HTTP_201_CREATED)
async def login_for_refresh_token(form_Data :LogIn, db:db_dependency):
    user = authenticate_user(form_Data.email, form_Data.password, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Could not validate user, check your credentials")
    token = create_token(user.email, user.id, timedelta(hours=2))
    return {'refresh_token':token}


@router.post('/generate_new_access_token',status_code=status.HTTP_201_CREATED)
async def generate_new_access_token(form_Data:RefreshToken, db: db_dependency):
    user_data = await get_user_from_token(form_Data.refresh_token)
    if not user_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Validation Failed")
    user = db.query(Users).filter(Users.email == user_data['email']).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='No such user found')
    access_token = create_token(user.email, user.id, timedelta(minutes=20))
    return {'access_token':access_token, "token_type":'bearer'}


@router.post('/forgot_password',status_code=status.HTTP_200_OK)
async def forgot_password(form_Data :SendMail, background_tasks : BackgroundTasks, db:db_dependency):
    user = db.query(Users).filter(Users.email == form_Data.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="There is no user with this email")
    
    reset_token = create_token(user.email, user.id, timedelta(minutes = 20))

    message = MessageSchema(
        subject='Password Reset Request',
        recipients=[form_Data.email],
        body = f"""
You have requested to reset your password. 

Please click on the following link to proceed with resetting your password: 
<a href="http://localhost:5173/reset_password/{reset_token}">Reset Password</a>

This link will expire in 20 minutes for security reasons. 

If you did not request a password reset, please ignore this email.
""",
        subtype=MessageType.html 
    )

    background_tasks.add_task(fm.send_message, message)
    return {"message", f"Email has been sent successfully to {form_Data.email}"}


@router.put('/reset_password/{reset_token}',status_code=status.HTTP_200_OK)
async def reset_password(reset_token:str, form_Data: ResetPassword, db:db_dependency):
    user_credentials = await get_user_from_token(reset_token)
    user = db.query(Users).filter(Users.email == user_credentials['email']).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in the database")
    user.hashed_password = bcrypt_context.hash(form_Data.password)
    db.commit()
    return {"message":"reset successful"}


@router.post('/verify_email',status_code=status.HTTP_200_OK)
async def verify_email(form_Data :SendMail, background_tasks : BackgroundTasks, db:db_dependency):
    user = db.query(Users).filter(Users.email == form_Data.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="There is no user with this email")
    
    verify_token = create_token(user.email, user.id, timedelta(minutes = 20))

    message = MessageSchema(
        subject='Email Verification Request',
        recipients=[form_Data.email],
        body = f"""
You have requested to verify your email address.

Please click the following link to complete the verification process: 
<a href="http://localhost:5173/verify_email/{verify_token}">Verify Email</a>

This link will expire in 20 minutes for security purposes.

If you did not request this, please ignore this email.
""",
        subtype=MessageType.html 
    )

    background_tasks.add_task(fm.send_message, message)
    return {"message", f"Email has been sent successfully to {form_Data.email}"}


@router.put('/verify_email/{verify_token}',status_code=status.HTTP_200_OK)
async def reset_password(verify_token:str, db:db_dependency):
    user_credentials = await get_user_from_token(verify_token)
    user = db.query(Users).filter(Users.email == user_credentials['email']).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in the database")
    user.verified = True
    db.commit()
    return {"message":"verified successfully"}







    

