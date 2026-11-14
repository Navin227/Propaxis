from fastapi import APIRouter

from app.api.v1.endpoints import demo, properties, units, users

api_router = APIRouter()
api_router.include_router(demo.router)
api_router.include_router(properties.router, prefix="/api/v1")
api_router.include_router(units.router, prefix="/api/v1")
api_router.include_router(users.router, prefix="/api/v1")
