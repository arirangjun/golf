"""Create tables and seed default accounts (Railway one-off or first deploy)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import Base, SessionLocal, engine
from app.models import Role, User
from app.services.formatting import hash_password


def ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)
    print("Schema ready (User, Reservation)")


def seed() -> None:
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@golf.com").first()
        if admin:
            admin.dong = "0"
            admin.ho = "admin"
        else:
            db.add(
                User(
                    email="admin@golf.com",
                    passwordHash=hash_password("admin1234"),
                    name="관리자",
                    dong="0",
                    ho="admin",
                    role=Role.ADMIN,
                    isActive=True,
                )
            )

        member_email = "101-1001@member.golf"
        member = db.query(User).filter(User.email == member_email).first()
        if member:
            member.dong = "101"
            member.ho = "1001"
            member.phone = "01012345678"
            member.passwordHash = hash_password("1")
            member.name = "홍길동"
        else:
            db.add(
                User(
                    email=member_email,
                    passwordHash=hash_password("1"),
                    name="홍길동",
                    phone="01012345678",
                    dong="101",
                    ho="1001",
                    role=Role.USER,
                    isActive=True,
                )
            )

        db.commit()
        print("Seed completed:")
        print("  Admin: admin@golf.com / admin1234")
        print("  Member: 101동 1001호 / password: 1")
    finally:
        db.close()


def main() -> None:
    ensure_schema()
    seed()


if __name__ == "__main__":
    main()
