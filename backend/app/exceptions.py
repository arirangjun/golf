from fastapi import Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


def unauthorized_handler(_request: Request, exc: Exception) -> JSONResponse:
    message = str(exc)
    if message == "UNAUTHORIZED":
        return JSONResponse(
            status_code=401,
            content={"error": {"code": "UNAUTHORIZED", "message": "로그인이 필요합니다."}},
        )
    if message == "FORBIDDEN":
        return JSONResponse(
            status_code=403,
            content={"error": {"code": "FORBIDDEN", "message": "접근 권한이 없습니다."}},
        )
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "서버 오류가 발생했습니다."}},
    )
