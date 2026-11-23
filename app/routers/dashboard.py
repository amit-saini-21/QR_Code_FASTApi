from fastapi import APIRouter, Depends, HTTPException, status
from app.database.schema import AuthUser
from sqlalchemy.orm import Session
from app.models.model import DashboardUserResponse
from app.utils.jwt import token_required
from app.database.database import get_db, find_user_by_email
from typing import cast

dashbsoard_router = APIRouter(prefix="/api/v1", tags=["Dashboard"])

@dashboard_router.get("/dashboard", response_model=DashboardUserResponse)
def dashboard(current_user: AuthUser = Depends(token_required), db: Session = Depends(get_db)):
    """
    Retrieves the authenticated user's information.

    Args:
        current_user (AuthUser): The currently authenticated user, obtained from the JWT token.
        db (Session): The database session.

    Returns:
        DashboardUserResponse: A response model containing the user's information.
    """
    # Fetch the user from the database using the email from the token
    db_user = find_user_by_email(db, email=cast(str, current_user.email))
    
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    
    return {
        "id": db_user.id,
        "name": db_user.name,
        "email": db_user.email,
        "is_active": db_user.is_active,
        "created_at": db_user.created_at
    }

@dashboard_router.get("/" , status_code=status.HTTP_200_OK)
def is_alive():
    """
    Health check endpoint to verify if the application is running.

    Returns:
        dict: A dictionary indicating that the application is alive.
    """
    return {"message": "Application is alive."}