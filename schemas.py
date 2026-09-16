from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SessionBase(BaseModel):
    title: str
    description: Optional[str] = None

class SessionCreate(SessionBase):
    pass

class SessionUpdate(SessionBase):
    title: Optional[str] = None

class SessionResponse(SessionBase):
    id: int
    teacher_id: int
    start_time: datetime

    class Config:
        from_attributes = True