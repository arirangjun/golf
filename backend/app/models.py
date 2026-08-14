import enum
from datetime import datetime

from cuid2 import cuid_wrapper
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

generate_id = cuid_wrapper()


class Role(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=lambda: generate_id())
    email: Mapped[str] = mapped_column(String(191), unique=True)
    passwordHash: Mapped[str] = mapped_column(String(191))
    name: Mapped[str] = mapped_column(String(191))
    phone: Mapped[str] = mapped_column(String(191), default="")
    dong: Mapped[str] = mapped_column(String(191), default="")
    ho: Mapped[str] = mapped_column(String(191), default="")
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.USER)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), onupdate=func.now()
    )

    reservations: Mapped[list["Reservation"]] = relationship(back_populates="user")
    suggestions: Mapped[list["Suggestion"]] = relationship(back_populates="user")

    __table_args__ = (Index("User_dong_ho_idx", "dong", "ho"),)


class Reservation(Base):
    __tablename__ = "Reservation"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=lambda: generate_id())
    userId: Mapped[str] = mapped_column(String(191), ForeignKey("User.id", ondelete="CASCADE"))
    date: Mapped[datetime] = mapped_column(DateTime(timezone=False))
    startHour: Mapped[int] = mapped_column(Integer)
    endHour: Mapped[int] = mapped_column(Integer)
    isSameDayBooking: Mapped[bool] = mapped_column(Boolean, default=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="reservations")

    __table_args__ = (
        Index("Reservation_userId_date_idx", "userId", "date"),
        Index("Reservation_date_idx", "date"),
        Index("Reservation_date_startHour_key", "date", "startHour", unique=True),
    )


class Suggestion(Base):
    __tablename__ = "Suggestion"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=lambda: generate_id())
    userId: Mapped[str] = mapped_column(String(191), ForeignKey("User.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(String(1000))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="suggestions")

    __table_args__ = (Index("Suggestion_createdAt_idx", "createdAt"),)
