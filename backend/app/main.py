from contextlib import asynccontextmanager
import asyncio

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app import database
from app.database import Base, get_engine
from app.exceptions import ApiError, api_error_handler
from app.models import Reservation, User  # noqa: F401 — register metadata
from app.routers import admin, auth, reservations, slots
from app.services.reservation_service import delete_expired_reservations
from app.services.seed_service import seed_default_accounts

RETENTION_CLEANUP_INTERVAL_SEC = 60 * 60 * 24  # 24h


def init_database() -> dict:
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    assert database.SessionLocal is not None
    db = database.SessionLocal()
    try:
        return seed_default_accounts(db)
    finally:
        db.close()


def run_reservation_retention_cleanup() -> int:
    assert database.SessionLocal is not None
    db = database.SessionLocal()
    try:
        return delete_expired_reservations(db)
    finally:
        db.close()


async def reservation_retention_loop() -> None:
    while True:
        await asyncio.sleep(RETENTION_CLEANUP_INTERVAL_SEC)
        try:
            deleted = await asyncio.to_thread(run_reservation_retention_cleanup)
            print(f"Reservation retention cleanup: deleted={deleted}")
        except Exception as exc:  # noqa: BLE001
            print(f"Warning: reservation retention cleanup failed: {type(exc).__name__}: {exc!r}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    cleanup_task: asyncio.Task | None = None
    try:
        result = init_database()
        print(f"DB ready: {result}")
    except Exception as exc:  # noqa: BLE001
        import traceback

        print(f"Warning: DB init/seed failed: {type(exc).__name__}: {exc!r}")
        traceback.print_exc()

    try:
        deleted = run_reservation_retention_cleanup()
        print(f"Reservation retention cleanup on startup: deleted={deleted}")
    except Exception as exc:  # noqa: BLE001
        print(
            f"Warning: reservation retention cleanup on startup failed: "
            f"{type(exc).__name__}: {exc!r}"
        )

    cleanup_task = asyncio.create_task(reservation_retention_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Screen Golf Reservation API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(ApiError, api_error_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "VALIDATION_ERROR", "message": "입력값을 확인해 주세요."}},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(_request: Request, exc: Exception):
    if str(exc) in ("UNAUTHORIZED", "FORBIDDEN"):
        status = 401 if str(exc) == "UNAUTHORIZED" else 403
        code = str(exc)
        message = "로그인이 필요합니다." if code == "UNAUTHORIZED" else "접근 권한이 없습니다."
        return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})
    raise exc


setup_router = APIRouter(prefix="/setup", tags=["setup"])


@setup_router.post("/seed")
def setup_seed():
    """Create tables + default accounts (idempotent)."""
    try:
        result = init_database()
        return {
            "ok": True,
            **result,
            "accounts": {
                "admin": "admin@golf.com / admin1234",
                "member": "101동 1001호 / 1",
            },
        }
    except Exception as exc:  # noqa: BLE001
        raise ApiError(
            "INTERNAL_ERROR",
            f"DB 시드 실패: {type(exc).__name__}: {exc!r}",
            500,
        ) from exc


@setup_router.get("/status")
def setup_status():
    try:
        get_engine()
        assert database.SessionLocal is not None
        db = database.SessionLocal()
        try:
            count = db.query(User).count()
            return {"ok": True, "userCount": count, "database": "connected"}
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            status_code=503,
            content={
                "ok": False,
                "database": "error",
                "message": f"{type(exc).__name__}: {exc!r}",
            },
        )


app.include_router(auth.router, prefix="/api")
app.include_router(reservations.router, prefix="/api")
app.include_router(slots.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(setup_router, prefix="/api")


@app.get("/health")
def health():
    db_ok = False
    db_message = "not_checked"
    try:
        get_engine()
        assert database.SessionLocal is not None
        db = database.SessionLocal()
        try:
            db_ok = db.query(User).count() >= 0
            db_message = "connected"
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        db_message = f"{type(exc).__name__}: {exc!r}"

    return {
        "ok": True,
        "environment": settings.environment,
        "database": {"ok": db_ok, "message": db_message},
    }
