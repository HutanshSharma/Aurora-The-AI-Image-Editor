from contextlib import asynccontextmanager
from fastapi import FastAPI
from .Routers import auth, segmentation,user, inpainting
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(lifespan=lifespan)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(user.router)
app.include_router(segmentation.router)
app.include_router(inpainting.router)
