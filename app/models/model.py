from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str
    #phone_number: Optional[str] = ""  # Optional field for phone number

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class DashboardUserResponse(BaseModel):

    id: int
    name: str
    email: EmailStr
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class QRCodeData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    qr_id: Optional[int] = None  # Optional field for QR code ID
    qr_type: str
    content: str = ""
    title: Optional[str] = None
    qr_format: Optional[str] = "png"
    qr_size: Optional[int] = 1024
    qr_color: Optional[str] = "#111827"
    background_color: Optional[str] = "#FFFFFF"
    corner_eye_color: Optional[str] = "#111827"
    qr_pattern_style: Optional[str] = "rounded"
    corner_eye_style: Optional[str] = "rounded"
    qr_logo: Optional[str] = None

class QRCodeNewData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    qr_id  : Optional[int] = None  # Optional field for QR code ID
    qr_type: Optional[str] = None 
    qr_format: Optional[str] = None  
    title: Optional[str] = None
    content: Optional[str] = None
    background_color: Optional[str] = None
    qr_color: Optional[str] = None
    qr_size: Optional[int] = None
    qr_logo: Optional[str] = None
    qr_pattern_style: Optional[str] = None
    corner_eye_style: Optional[str] = None
    corner_eye_color: Optional[str] = None
    