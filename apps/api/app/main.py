from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4
import logging

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# rembg 是可选依赖，不可用时降级为保存原图
try:
    from rembg import remove as rembg_remove
    _REMBG_AVAILABLE = True
except Exception:  # noqa: BLE001
    _REMBG_AVAILABLE = False
    logger.warning("rembg not available, background removal disabled")

# replicate 是可选依赖
try:
    import replicate as _replicate_lib
    _REPLICATE_AVAILABLE = True
except Exception:  # noqa: BLE001
    _REPLICATE_AVAILABLE = False
    logger.warning("replicate not available, AI try-on via Replicate disabled")

# gradio_client 是可选依赖（HuggingFace Spaces）
try:
    from gradio_client import Client as _GradioClient, handle_file as _hf_handle_file
    _GRADIO_AVAILABLE = True
except Exception:  # noqa: BLE001
    _GRADIO_AVAILABLE = False
    logger.warning("gradio_client not available, AI try-on via HuggingFace disabled")

from .config import settings
from .db import get_session, init_db
from .models import Avatar, AvatarCreate, AvatarUpdate, Garment, GarmentCreate
from .repository import AvatarRepository, GarmentRepository

upload_root = Path(settings.upload_dir)
garment_upload_root = upload_root / "garments"
# 模板人体照片：优先 uploads/templates（本地覆盖），回退到 static/templates（随代码提交）
_static_template_root = Path(__file__).resolve().parents[1] / "static" / "templates"
template_root = upload_root / "templates"
tryon_result_root = upload_root / "tryon"
upload_root.mkdir(parents=True, exist_ok=True)

# IDM-VTON 服装类别映射
_CATEGORY_MAP = {
    "tshirt": "upper_body",
    "shirt":  "upper_body",
    "dress":  "dresses",
    "pants":  "lower_body",
    "unknown": "upper_body",
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    garment_upload_root.mkdir(parents=True, exist_ok=True)
    template_root.mkdir(parents=True, exist_ok=True)
    tryon_result_root.mkdir(parents=True, exist_ok=True)
    init_db()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.mount("/uploads", StaticFiles(directory=upload_root), name="uploads")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
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

    file_id = uuid4()

    # 尝试去背景，成功则保存为透明 PNG；失败则保存原图
    raw_bytes = file.file.read()
    removed_bg = False

    if _REMBG_AVAILABLE:
        try:
            result_bytes = rembg_remove(raw_bytes)
            target_name = f"{file_id}.png"
            target_path = garment_upload_root / target_name
            target_path.write_bytes(result_bytes)
            removed_bg = True
        except Exception as exc:  # noqa: BLE001
            logger.warning("rembg failed (%s), saving original", exc)

    if not removed_bg:
        target_name = f"{file_id}{suffix}"
        target_path = garment_upload_root / target_name
        target_path.write_bytes(raw_bytes)

    image_path = f"/uploads/garments/{target_name}"
    image_url = str(request.base_url).rstrip("/") + image_path
    return {
        "imageUrl": image_url,
        "path": image_path,
        "filename": target_name,
        "removedBg": "true" if removed_bg else "false",
    }


# ── AI 试穿 ────────────────────────────────────────────────────────────────

class TryOnRequest(BaseModel):
    avatarId: str
    garmentId: str


async def _tryon_replicate(
    template_path: Path, garment_path: Path, garment_des: str, category: str
) -> str:
    """调用 Replicate IDM-VTON，返回结果图片 URL。"""
    if not _REPLICATE_AVAILABLE:
        raise HTTPException(status_code=503, detail="replicate package not installed")
    if not settings.replicate_api_token:
        raise HTTPException(status_code=503, detail="REPLICATE_API_TOKEN not configured in .env")

    client = _replicate_lib.Client(api_token=settings.replicate_api_token)
    with open(template_path, "rb") as hf, open(garment_path, "rb") as gf:
        output = await client.async_run(
            "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985",
            input={
                "human_img":       hf,
                "garm_img":        gf,
                "garment_des":     garment_des,
                "category":        category,
                "is_checked":      True,
                "is_checked_crop": False,
                "denoise_steps":   30,
                "seed":            42,
            },
        )
    result = output[0] if isinstance(output, list) else output
    return str(result)


async def _tryon_huggingface(
    template_path: Path, garment_path: Path, garment_des: str,
    base_url: str,
) -> str:
    """调用 HuggingFace Space IDM-VTON，结果保存本地后返回 URL。"""
    import asyncio

    if not _GRADIO_AVAILABLE:
        raise HTTPException(status_code=503, detail="gradio_client package not installed")

    client = _GradioClient(
        settings.hf_tryon_space,
        token=settings.hf_token or None,
    )
    try:
        result = await asyncio.to_thread(
            client.predict,
            dict={"background": _hf_handle_file(str(template_path)), "layers": [], "composite": None},
            garm_img=_hf_handle_file(str(garment_path)),
            garment_des=garment_des,
            is_checked=True,
            is_checked_crop=False,
            denoise_steps=30,
            seed=42,
            api_name="/tryon",
        )
    except Exception as exc:
        logger.error("HuggingFace Space error: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}") from exc

    # result 是 (output_img_path, masked_img_path)，均为本地临时文件
    output_tmp = Path(result[0])
    dest_name = f"{uuid4()}{output_tmp.suffix or '.jpg'}"
    dest_path = tryon_result_root / dest_name
    dest_path.write_bytes(output_tmp.read_bytes())
    return f"{base_url}/uploads/tryon/{dest_name}"


@app.post("/api/tryon/generate")
async def generate_tryon(payload: TryOnRequest, request: Request) -> dict[str, str]:
    """生成 AI 试穿效果图。

    服务商通过 TRYON_PROVIDER 切换（.env）：
      TRYON_PROVIDER=replicate   → 调用 Replicate（需 REPLICATE_API_TOKEN，约 $0.03/次）
      TRYON_PROVIDER=huggingface → 调用 HuggingFace Space（免费，较慢）

    模板照片放在 uploads/templates/<gender>.jpg（正面站立，背景简洁）。
    """
    # ── 获取服装 ──
    with get_session() as session:
        garment = GarmentRepository(session).get(payload.garmentId)
    if garment is None:
        raise HTTPException(status_code=404, detail="Garment not found")

    garment_filename = Path(garment.imageUrl).name
    garment_path = garment_upload_root / garment_filename
    if not garment_path.exists():
        raise HTTPException(status_code=404, detail=f"Garment image not found: {garment_filename}")

    # ── 获取模板照片 ──
    with get_session() as session:
        avatar = AvatarRepository(session).get(payload.avatarId)
    if avatar is None:
        raise HTTPException(status_code=404, detail="Avatar not found")

    gender = avatar.baseGender
    template_path = next(
        (p for p in [
            template_root / f"{gender}.jpg",
            template_root / f"{gender}.png",
            template_root / "neutral.jpg",
            template_root / "neutral.png",
            _static_template_root / f"{gender}.jpg",
            _static_template_root / f"{gender}.png",
            _static_template_root / "neutral.jpg",
            _static_template_root / "neutral.png",
        ] if p.exists()),
        None,
    )
    if template_path is None:
        raise HTTPException(
            status_code=422,
            detail=f"No template photo found. Add uploads/templates/{gender}.jpg (front-facing, plain background).",
        )

    tryon_category = _CATEGORY_MAP.get(garment.category, "upper_body")
    garment_des = f"{garment.name} {garment.category}"
    base_url = str(request.base_url).rstrip("/")

    # ── 分派到服务商 ──
    provider = settings.tryon_provider.lower()
    if provider == "huggingface":
        image_url = await _tryon_huggingface(template_path, garment_path, garment_des, base_url)
    else:
        image_url = await _tryon_replicate(template_path, garment_path, garment_des, tryon_category)

    return {"imageUrl": image_url}
