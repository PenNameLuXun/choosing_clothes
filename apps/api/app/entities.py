from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class AvatarRecord(Base):
    __tablename__ = "avatars"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    base_gender: Mapped[str] = mapped_column(String(16), nullable=False)
    height_cm: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    shoulder_cm: Mapped[float] = mapped_column(Float, nullable=False)
    chest_cm: Mapped[float] = mapped_column(Float, nullable=False)
    waist_cm: Mapped[float] = mapped_column(Float, nullable=False)
    hip_cm: Mapped[float] = mapped_column(Float, nullable=False)
    leg_length_cm: Mapped[float] = mapped_column(Float, nullable=False)
    arm_length_cm: Mapped[float] = mapped_column(Float, nullable=False)
    morph_params: Mapped[dict[str, float]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
