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
    deletedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), onupdate=func.now()
    )

    reservations: Mapped[list["Reservation"]] = relationship(back_populates="user")
    suggestions: Mapped[list["Suggestion"]] = relationship(back_populates="user")
    friendships: Mapped[list["Friendship"]] = relationship(
        back_populates="user",
        foreign_keys="Friendship.userId",
    )

    __table_args__ = (Index("User_dong_ho_idx", "dong", "ho"),)


class Reservation(Base):
    __tablename__ = "Reservation"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=lambda: generate_id())
    userId: Mapped[str] = mapped_column(String(191), ForeignKey("User.id", ondelete="CASCADE"))
    date: Mapped[datetime] = mapped_column(DateTime(timezone=False))
    startHour: Mapped[int] = mapped_column(Integer)
    endHour: Mapped[int] = mapped_column(Integer)
    isSameDayBooking: Mapped[bool] = mapped_column(Boolean, default=False)
    groupId: Mapped[str | None] = mapped_column(String(191), nullable=True, default=None)
    organizerId: Mapped[str | None] = mapped_column(String(191), nullable=True, default=None)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="reservations")

    __table_args__ = (
        Index("Reservation_userId_date_idx", "userId", "date"),
        Index("Reservation_date_idx", "date"),
        Index("Reservation_date_startHour_key", "date", "startHour", unique=True),
        Index("Reservation_groupId_idx", "groupId"),
    )


class Friendship(Base):
    __tablename__ = "Friendship"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=lambda: generate_id())
    userId: Mapped[str] = mapped_column(String(191), ForeignKey("User.id", ondelete="CASCADE"))
    friendId: Mapped[str] = mapped_column(String(191), ForeignKey("User.id", ondelete="CASCADE"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())

    user: Mapped[User] = relationship(
        back_populates="friendships",
        foreign_keys=[userId],
    )
    friend: Mapped[User] = relationship(foreign_keys=[friendId])

    __table_args__ = (
        Index("Friendship_userId_friendId_key", "userId", "friendId", unique=True),
        Index("Friendship_userId_idx", "userId"),
    )


class Suggestion(Base):
    __tablename__ = "Suggestion"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=lambda: generate_id())
    userId: Mapped[str] = mapped_column(String(191), ForeignKey("User.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(String(1000))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="suggestions")

    __table_args__ = (Index("Suggestion_createdAt_idx", "createdAt"),)


class SlotOverrideMode(str, enum.Enum):
    BLOCKED = "BLOCKED"
    FORCE_OPEN = "FORCE_OPEN"


class SlotOverride(Base):
    """관리자가 날짜·시간 단위로 예약가능/불가를 덮어쓰는 설정."""

    __tablename__ = "SlotOverride"

    id: Mapped[str] = mapped_column(String(191), primary_key=True, default=lambda: generate_id())
    date: Mapped[datetime] = mapped_column(DateTime(timezone=False))
    startHour: Mapped[int] = mapped_column(Integer)
    mode: Mapped[SlotOverrideMode] = mapped_column(Enum(SlotOverrideMode))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=False), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("SlotOverride_date_startHour_key", "date", "startHour", unique=True),
        Index("SlotOverride_date_idx", "date"),
    )
