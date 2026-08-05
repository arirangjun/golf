from sqlalchemy.orm import Session

from app.models import Role, User
from app.services.formatting import hash_password


def seed_default_accounts(db: Session) -> dict:
    """Ensure admin + sample member exist. Safe to call repeatedly."""
    created: list[str] = []

    admin = db.query(User).filter(User.email == "admin@golf.com").first()
    if not admin:
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
        created.append("admin")
    else:
        admin.dong = "0"
        admin.ho = "admin"
        admin.isActive = True

    member_email = "101-1001@member.golf"
    member = db.query(User).filter(User.email == member_email).first()
    if not member:
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
        created.append("member")
    else:
        member.dong = "101"
        member.ho = "1001"
        member.phone = "01012345678"
        member.name = "홍길동"
        member.isActive = True

    db.commit()
    total = db.query(User).count()
    return {"created": created, "userCount": total}
