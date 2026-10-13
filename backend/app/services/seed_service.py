from sqlalchemy.orm import Session

from app.models import Role, User
from app.services.formatting import hash_password


def seed_default_accounts(db: Session) -> dict:
    """Ensure the admin account exists. Safe to call repeatedly."""
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

    db.commit()
    total = db.query(User).count()
    return {"created": created, "userCount": total}
