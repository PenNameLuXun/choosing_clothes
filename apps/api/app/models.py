from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from .entities import AvatarRecord
from .entities import GarmentRecord


class AvatarInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    baseGender: Literal["female", "male", "neutral"]
    heightCm: int = Field(ge=120, le=230)
    weightKg: float = Field(gt=20, le=300)
    shoulderCm: float = Field(gt=20, le=80)
    chestCm: float = Field(gt=40, le=200)
    waistCm: float = Field(gt=30, le=200)
    hipCm: float = Field(gt=40, le=220)
    legLengthCm: float = Field(gt=40, le=160)
    armLengthCm: float = Field(gt=30, le=120)
    morphParams: dict[str, float]


class AvatarCreate(AvatarInput):
    pass


class AvatarUpdate(AvatarInput):
    pass


class Avatar(BaseModel):
    id: str
    name: str
    baseGender: Literal["female", "male", "neutral"]
    heightCm: int
    weightKg: float
    shoulderCm: float
    chestCm: float
    waistCm: float
    hipCm: float
    legLengthCm: float
    armLengthCm: float
    morphParams: dict[str, float]
    createdAt: str
    updatedAt: str

    @classmethod
    def from_create(cls, payload: AvatarCreate) -> "Avatar":
        timestamp = datetime.now(timezone.utc).isoformat()
        return cls(
            id=str(uuid4()),
            name=payload.name,
            baseGender=payload.baseGender,
            heightCm=payload.heightCm,
            weightKg=payload.weightKg,
            shoulderCm=payload.shoulderCm,
            chestCm=payload.chestCm,
            waistCm=payload.waistCm,
            hipCm=payload.hipCm,
            legLengthCm=payload.legLengthCm,
            armLengthCm=payload.armLengthCm,
            morphParams=payload.morphParams,
            createdAt=timestamp,
            updatedAt=timestamp,
        )

    @classmethod
    def from_record(cls, record: AvatarRecord) -> "Avatar":
        return cls(
            id=record.id,
            name=record.name,
            baseGender=record.base_gender,
            heightCm=record.height_cm,
            weightKg=record.weight_kg,
            shoulderCm=record.shoulder_cm,
            chestCm=record.chest_cm,
            waistCm=record.waist_cm,
            hipCm=record.hip_cm,
            legLengthCm=record.leg_length_cm,
            armLengthCm=record.arm_length_cm,
            morphParams=record.morph_params,
            createdAt=record.created_at.isoformat(),
            updatedAt=record.updated_at.isoformat(),
        )

    def to_record(self) -> AvatarRecord:
        return AvatarRecord(
            id=self.id,
            name=self.name,
            base_gender=self.baseGender,
            height_cm=self.heightCm,
            weight_kg=self.weightKg,
            shoulder_cm=self.shoulderCm,
            chest_cm=self.chestCm,
            waist_cm=self.waistCm,
            hip_cm=self.hipCm,
            leg_length_cm=self.legLengthCm,
            arm_length_cm=self.armLengthCm,
            morph_params=self.morphParams,
            created_at=datetime.fromisoformat(self.createdAt),
            updated_at=datetime.fromisoformat(self.updatedAt),
        )

    def apply_update(self, payload: AvatarUpdate) -> "Avatar":
        return self.model_copy(
            update={
                "name": payload.name,
                "baseGender": payload.baseGender,
                "heightCm": payload.heightCm,
                "weightKg": payload.weightKg,
                "shoulderCm": payload.shoulderCm,
                "chestCm": payload.chestCm,
                "waistCm": payload.waistCm,
                "hipCm": payload.hipCm,
                "legLengthCm": payload.legLengthCm,
                "armLengthCm": payload.armLengthCm,
                "morphParams": payload.morphParams,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        )


class GarmentInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: Literal["tshirt", "shirt", "dress", "pants", "unknown"]
    imageUrl: str = Field(min_length=1, max_length=512)


class GarmentCreate(GarmentInput):
    pass


class Garment(BaseModel):
    id: str
    name: str
    category: Literal["tshirt", "shirt", "dress", "pants", "unknown"]
    imageUrl: str
    status: Literal["uploaded", "parsing", "ready", "failed"]
    parsedMeta: dict[str, str | int | float | bool | None]
    createdAt: str
    updatedAt: str

    @classmethod
    def from_create(cls, payload: GarmentCreate) -> "Garment":
        timestamp = datetime.now(timezone.utc).isoformat()
        return cls(
            id=str(uuid4()),
            name=payload.name,
            category=payload.category,
            imageUrl=payload.imageUrl,
            status="uploaded",
            parsedMeta={},
            createdAt=timestamp,
            updatedAt=timestamp,
        )

    @classmethod
    def from_record(cls, record: GarmentRecord) -> "Garment":
        return cls(
            id=record.id,
            name=record.name,
            category=record.category,
            imageUrl=record.image_url,
            status=record.status,
            parsedMeta=record.parsed_meta,
            createdAt=record.created_at.isoformat(),
            updatedAt=record.updated_at.isoformat(),
        )

    def to_record(self) -> GarmentRecord:
        return GarmentRecord(
            id=self.id,
            name=self.name,
            category=self.category,
            image_url=self.imageUrl,
            status=self.status,
            parsed_meta=self.parsedMeta,
            created_at=datetime.fromisoformat(self.createdAt),
            updated_at=datetime.fromisoformat(self.updatedAt),
        )
