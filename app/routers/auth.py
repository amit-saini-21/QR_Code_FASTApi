from fastapi import APIRouter, Depends, HTTPException, status
from database.schema import AuthUser
from utils import hash, jwt, common_utils
from database.database import creata_user, get_db, find_user_by_email
from sqlalchemy.orm import Session
from models.model import UserCreate, UserLogin, UserResponse, UserLoginResponse
from typing import cast

auth_router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@auth_router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new user.

    Args:
        user (UserCreate): A UserCreate object containing user details (name, email, password, phone_number).
        db (Session): The database session.

    Returns:
        dict: A dictionary containing the registered user's details.
    """
    # Validate user input
    if not common_utils.validate_name(user.name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid name format.")
    
    if not common_utils.validate_email(user.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email format.")
    
    # if not common_utils.validate_phone_number(user.phone_number):
    #     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid phone number format.")
    
    if not common_utils.validate_password(user.password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password does not meet complexity requirements.")

    if user.password != user.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match.")

    # Check if the email already exists in the database
    existing_user = find_user_by_email(db, email=user.email)
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists.")

    # Hash the password
    hashed_password = hash.hash_password(user.password)

    # Store the user in the database (pseudo-code)
    new_user = creata_user(db, name=user.name, email=user.email, password=hashed_password)  
    return {"message": "User registered successfully.", "name": new_user.name, "email": new_user.email, "id": new_user.id}

@auth_router.post("/login", response_model=UserLoginResponse)
def login_user(user: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticates a user and returns a JWT token.

    Args:
        user (UserLogin): A UserLogin object containing user credentials (email, password).
        db (Session): The database session.
    Returns:
        UserLoginResponse: A UserLoginResponse object containing the JWT token.
    """
    # Fetch the user from the database (pseudo-code)
    db_user = find_user_by_email(db, email=user.email)
    
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    
    # Check the password
    if not hash.check_password_hash(cast(str, db_user.password), user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    
    # Generate JWT token
    token = jwt.generate_token(db_user)
    
    return {"access_token": token, "token_type": "bearer"}

@auth_router.get("/me", response_model=UserResponse)
def get_current_user(current_user: AuthUser = Depends(jwt.token_required)):
    """
    Retrieves the current authenticated user.

    Args:
        current_user (AuthUser): The currently authenticated user.

    Returns:
        AuthUser: The current user object.
    """
    return current_user

@auth_router.post("/logout")
def logout_user():
    """
    Logs out the current user.

    Returns:
        dict: A dictionary indicating successful logout.
    """
    # Invalidate the token or perform any necessary logout actions (pseudo-code)
    return {"message": "User logged out successfully."}