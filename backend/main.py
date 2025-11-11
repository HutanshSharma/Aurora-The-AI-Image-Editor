from fastapi import FastAPI
import backend.models as models
from .database import engine
from .Routers import auth,user
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
origins = [
    "http://localhost:5173" # production site
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  
    allow_credentials=True,        
    allow_methods=["*"],            
    allow_headers=["*"],           
)

models.Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(user.router)
