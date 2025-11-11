from fastapi import APIRouter,status, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Annotated
from ..database import Sessionmaker
from ..models import Users
from .auth import get_current_user

router = APIRouter(
    tags=['/user'],
    prefix='/user'
)

def get_db():
    db = Sessionmaker()
    try:
        yield db
    finally:
        db.close()

user_dependency = Annotated[dict, Depends(get_current_user)]
db_dependency = Annotated[Session, Depends(get_db)]

@router.get('/',status_code=status.HTTP_200_OK)
def user(current_user : user_dependency, db : db_dependency):
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You are not authorized")

    user = db.query(Users).filter(current_user['email'] == Users.email).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="No user exit")
    
    return user
