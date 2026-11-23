from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.database.database import find_user_by_id, get_db
from sqlalchemy.orm import Session
from app.database.schema import AuthUser
import jwt
import datetime
import os
from typing import cast
import dotenv

algorithm = "HS256"
dotenv.load_dotenv()

secret_key = os.getenv("SECRET_KEY")

if not secret_key:
    raise ValueError("SECRET_KEY environment variable is not set.")

bearer_scheme = HTTPBearer(auto_error=True)

def token_required(token: HTTPAuthorizationCredentials = Depends(bearer_scheme), db: Session = Depends(get_db)):
    """
    Dependency function to validate JWT token.

    Args:
        token (HTTPAuthorizationCredentials): The JWT token extracted from the request header.
        db (Session): The database session.

    Returns:
        dict: The decoded payload of the JWT token.

    Raises:
        HTTPException: If the token is invalid or expired.
    """
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token is missing.")
    if db is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database session is not available.")
    
    try:
        payload = jwt.decode(token.credentials, cast(str, secret_key), algorithms=[algorithm])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")
        user = find_user_by_id(db, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
        return user
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")

def generate_token(user: AuthUser) -> str:
    """
    Generates a JWT token for the given user.

    Args:
        user (AuthUser): The user for whom to generate a token.

    Returns:
        str: The generated JWT token.

    """
    payload = {
        "user_id": user.id,
        "name": user.name,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }
    return jwt.encode(payload, cast(str, secret_key), algorithm=algorithm)

