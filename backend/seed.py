"""Seed initial admin and test member accounts."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Role, User
from app.services.formatting import hash_password


def main() -> None:
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@golf.com").first()
        if admin:
            admin.dong = "0"
            admin.ho = "admin"
        else:
            admin = User(
                email="admin@golf.com",
                passwordHash=hash_password("admin1234"),
                name="관리자",
                dong="0",
                ho="admin",
                role=Role.ADMIN,
                isActive=True,
            )
            db.add(admin)

        member_email = "101-1001@member.golf"
        member = db.query(User).filter(User.email == member_email).first()
        if member:
            member.dong = "101"
            member.ho = "1001"
            member.phone = "01012345678"
            member.passwordHash = hash_password("1")
            member.name = "홍길동"
        else:
            member = User(
                email=member_email,
                passwordHash=hash_password("1"),
                name="홍길동",
                phone="01012345678",
                dong="101",
                ho="1001",
                role=Role.USER,
                isActive=True,
            )
            db.add(member)

        db.commit()
        print("Seed completed:")
        print("  Admin: admin@golf.com / admin1234")
        print("  Member: 101동 1001호 / password: 1")
    finally:
        db.close()


if __name__ == "__main__":
    main()
