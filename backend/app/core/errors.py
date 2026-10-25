"""Consistent JSON errors: no stack traces, paths, or secrets in responses."""
from fastapi import Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: dict | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code,
                        content={'error': {'code': exc.code, 'message': exc.message, 'details': exc.details}})
