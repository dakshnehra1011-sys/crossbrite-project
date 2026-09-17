from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SessionBase(BaseModel):
    title: str
    description: Optional[str] = None

class SessionCreate(SessionBase):
    student_ids: Optional[list[int]] = []

class StudentResponse(BaseModel):
    id: int
    name: str
    roll_no: Optional[str] = None
    
    class Config:
        from_attributes = True

class SessionUpdate(SessionBase):
    title: Optional[str] = None

class SessionResponse(SessionBase):
    id: int
    teacher_id: int
    start_time: datetime

    class Config:
        from_attributes = True

class PasswordChange(BaseModel):
    new_password: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    is_approved: bool

    class Config:
        from_attributes = True