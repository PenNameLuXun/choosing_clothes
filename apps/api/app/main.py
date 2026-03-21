from contextlib import asynccontextmanager
from pathlib import Path
from shutil import copyfileobj
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import get_session, init_db
from .models import Avatar, AvatarCreate, AvatarUpdate, Garment, GarmentCreate
from .repository import AvatarRepository, GarmentRepository

upload_root = Path(settings.upload_dir)
garment_upload_root = upload_root / "garments"
upload_root.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    garment_upload_root.mkdir(parents=True, exist_ok=True)
    init_db()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.mount("/uploads", StaticFiles(directory=upload_root), name="uploads")
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
        "stage": "stage-3"
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


@app.get("/api/garments", response_model=list[Garment])
def list_garments() -> list[Garment]:
    with get_session() as session:
        return GarmentRepository(session).list()


@app.post("/api/garments", response_model=Garment, status_code=status.HTTP_201_CREATED)
def create_garment(payload: GarmentCreate) -> Garment:
    garment = Garment.from_create(payload)
    with get_session() as session:
        return GarmentRepository(session).create(garment)


@app.get("/api/garments/{garment_id}", response_model=Garment)
def get_garment(garment_id: str) -> Garment:
    with get_session() as session:
        garment = GarmentRepository(session).get(garment_id)

    if garment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Garment not found")
    return garment


@app.post("/api/uploads/garments")
def upload_garment_image(request: Request, file: UploadFile = File(...)) -> dict[str, str]:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file selected")

    suffix = Path(file.filename).suffix.lower()
    allowed_suffixes = {".png", ".jpg", ".jpeg", ".webp"}
    if suffix not in allowed_suffixes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")

    target_name = f"{uuid4()}{suffix}"
    target_path = garment_upload_root / target_name

    with target_path.open("wb") as output:
        copyfileobj(file.file, output)

    image_path = f"/uploads/garments/{target_name}"
    image_url = str(request.base_url).rstrip("/") + image_path
    return {
        "imageUrl": image_url,
        "path": image_path,
        "filename": target_name,
    }
