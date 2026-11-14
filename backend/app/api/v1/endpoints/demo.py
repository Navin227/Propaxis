from fastapi import APIRouter, HTTPException, status

from app.core.demo_users import DEMO_USERS, get_demo_user

router = APIRouter(prefix="/api/v1/demo", tags=["demo-only"])


@router.get("/users")
def list_demo_users() -> list[dict[str, object]]:
    return [dict(user) for user in DEMO_USERS]


@router.get("/users/{user_id}")
def read_demo_user(user_id: str) -> dict[str, object]:
    user = get_demo_user(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown demo user ID.",
        )
    return dict(user)
