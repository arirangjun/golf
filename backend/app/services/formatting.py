import re
import uuid

import bcrypt

from app.services.booking_rules import DEFAULT_MEMBER_PASSWORD


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=10)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def normalize_phone(phone: str) -> str:
    return re.sub(r"\D", "", phone)


def format_phone(phone: str) -> str:
    if not phone:
        return ""
    digits = normalize_phone(phone)
    if len(digits) == 11:
        return f"{digits[:3]}-{digits[3:7]}-{digits[7:]}"
    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    return phone


def format_unit(dong: str, ho: str) -> str:
    d = dong.strip()
    h = ho.strip()
    if not d and not h:
        return ""
    dong_label = d if d.endswith("동") else f"{d}동"
    return f"{dong_label} {h}호" if h else dong_label


def mask_name(name: str) -> str:
    trimmed = name.strip()
    if len(trimmed) <= 1:
        return trimmed
    if len(trimmed) == 2:
        return f"{trimmed[0]}*"
    if len(trimmed) == 3:
        return f"{trimmed[0]}*{trimmed[2]}"
    return f"{trimmed[0]}{'*' * (len(trimmed) - 2)}{trimmed[-1]}"


def format_member_display(dong: str, name: str) -> str:
    if not dong.strip():
        return mask_name(name)
    dong_label = dong.strip() if dong.strip().endswith("동") else f"{dong.strip()}동"
    return f"{dong_label} {mask_name(name)}"


def default_member_password() -> str:
    return DEFAULT_MEMBER_PASSWORD


def generate_unique_member_email(dong: str, ho: str, existing_emails: set[str]) -> str:
    base = f"{dong.strip()}-{ho.strip()}"
    for attempt in range(100):
        suffix = "" if attempt == 0 else f"-{attempt + 1}"
        email = f"{base}{suffix}@member.golf"
        if email not in existing_emails:
            return email
    return f"{base}-{uuid.uuid4().hex[:8]}@member.golf"
