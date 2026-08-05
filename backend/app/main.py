from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, engine
from app.exceptions import ApiError, api_error_handler
from app.models import Reservation, User  # noqa: F401 — register metadata
from app.routers import admin, auth, reservations, slots


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


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


app.include_router(auth.router, prefix="/api")
app.include_router(reservations.router, prefix="/api")
app.include_router(slots.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/health")
def health():
    return {"ok": True, "environment": settings.environment}
