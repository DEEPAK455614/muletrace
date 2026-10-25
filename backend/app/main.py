from fastapi import FastAPI
from sqlalchemy import text

from app.api.v1.analysis import router as analysis_router
from app.api.v1.datasets import router as datasets_router
from app.api.v1.training import router as training_router
from app.core.config import settings
from app.core.errors import ApiError, api_error_handler
from app.db.session import engine

app = FastAPI(title=settings.app_name, docs_url=None, redoc_url=None, openapi_url=None)
app.add_exception_handler(ApiError, api_error_handler)
app.include_router(datasets_router)
app.include_router(training_router, prefix='/api/v1')
app.include_router(analysis_router, prefix='/api/v1')


@app.get('/health')
def health():
    db_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        db_ok = True
    except Exception:
        db_ok = False
    return {'status': 'ok' if db_ok else 'degraded', 'database': db_ok}
