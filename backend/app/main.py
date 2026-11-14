from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints import health
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging

configure_logging()
settings = get_settings()

app = FastAPI(
    title="PropAxis API",
    version="0.1.0",
    description=(
        "Demo-mode property and unit operations API. Property/unit endpoints "
        "require x-user-id; x-user-role is ignored. This is not production authentication."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Page-Limit", "X-Page-Offset"],
)
register_exception_handlers(app)
app.include_router(health.router)
app.include_router(api_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "PropAxis API",
        "version": app.version,
        "status": "ok",
    }
