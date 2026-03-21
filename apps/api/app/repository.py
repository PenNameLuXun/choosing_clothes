from sqlalchemy.orm import Session

from .entities import AvatarRecord
from .entities import GarmentRecord
from .models import Avatar
from .models import Garment


class AvatarRepository:
    def __init__(self, session: Session):
        self.session = session

    def list(self) -> list[Avatar]:
        records = self.session.query(AvatarRecord).order_by(AvatarRecord.created_at.asc()).all()
        return [Avatar.from_record(record) for record in records]

    def create(self, avatar: Avatar) -> Avatar:
        record = avatar.to_record()
        self.session.add(record)
        self.session.flush()
        self.session.refresh(record)
        return Avatar.from_record(record)

    def get(self, avatar_id: str) -> Avatar | None:
        record = self.session.get(AvatarRecord, avatar_id)
        if record is None:
            return None
        return Avatar.from_record(record)

    def update(self, avatar: Avatar) -> Avatar | None:
        record = self.session.get(AvatarRecord, avatar.id)
        if record is None:
            return None

        record.name = avatar.name
        record.base_gender = avatar.baseGender
        record.height_cm = avatar.heightCm
        record.weight_kg = avatar.weightKg
        record.shoulder_cm = avatar.shoulderCm
        record.chest_cm = avatar.chestCm
        record.waist_cm = avatar.waistCm
        record.hip_cm = avatar.hipCm
        record.leg_length_cm = avatar.legLengthCm
        record.arm_length_cm = avatar.armLengthCm
        record.morph_params = avatar.morphParams
        record.updated_at = avatar.to_record().updated_at
        self.session.flush()
        self.session.refresh(record)
        return Avatar.from_record(record)


class GarmentRepository:
    def __init__(self, session: Session):
        self.session = session

    def list(self) -> list[Garment]:
        records = self.session.query(GarmentRecord).order_by(GarmentRecord.created_at.desc()).all()
        return [Garment.from_record(record) for record in records]

    def create(self, garment: Garment) -> Garment:
        record = garment.to_record()
        self.session.add(record)
        self.session.flush()
        self.session.refresh(record)
        return Garment.from_record(record)

    def get(self, garment_id: str) -> Garment | None:
        record = self.session.get(GarmentRecord, garment_id)
        if record is None:
            return None
        return Garment.from_record(record)
