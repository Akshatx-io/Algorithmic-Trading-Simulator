from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


# class UserResponse(BaseModel):
#     id: int
#     username: str
#     created_at: datetime
#     is_active: bool = True

#     class Config:
#         from_attributes = True

class UserResponse(BaseModel):
    id: int
    username: str
    balance: float
    access_token: str
    created_at: datetime | None = None  # 🔥 SAFE FIX

    class Config:
        from_attributes = True
