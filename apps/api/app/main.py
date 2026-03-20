from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import get_session, init_db
from .models import Avatar, AvatarCreate, AvatarUpdate
from .repository import AvatarRepository


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": "api"}


@app.get("/api/meta")
def meta() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "environment": settings.app_env,
        "stage": "stage-2"
    }


@app.get("/api/avatars", response_model=list[Avatar])
def list_avatars() -> list[Avatar]:
    with get_session() as session:
        return AvatarRepository(session).list()


@app.post("/api/avatars", response_model=Avatar, status_code=status.HTTP_201_CREATED)
def create_avatar(payload: AvatarCreate) -> Avatar:
    avatar = Avatar.from_create(payload)
    with get_session() as session:
        return AvatarRepository(session).create(avatar)


@app.get("/api/avatars/{avatar_id}", response_model=Avatar)
def get_avatar(avatar_id: str) -> Avatar:
    with get_session() as session:
        avatar = AvatarRepository(session).get(avatar_id)

    if avatar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    return avatar


@app.put("/api/avatars/{avatar_id}", response_model=Avatar)
def update_avatar(avatar_id: str, payload: AvatarUpdate) -> Avatar:
    with get_session() as session:
        repository = AvatarRepository(session)
        current_avatar = repository.get(avatar_id)
        if current_avatar is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")

        updated_avatar = current_avatar.apply_update(payload)
        saved_avatar = repository.update(updated_avatar)

    if saved_avatar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    return saved_avatar
