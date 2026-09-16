from fastapi import Header, HTTPException
from pydantic import BaseModel

class CurrentUser(BaseModel):
    id: int
    role: str

def get_current_user(
    x_user_id: int = Header(...),
    x_user_role: str = Header(...)
) -> CurrentUser:
    valid_roles = ["admin", "teacher", "parent"]
    
    
    if x_user_role not in valid_roles:
        raise HTTPException(status_code=400, detail="Invalid role provided")
        
    return CurrentUser(id=x_user_id, role=x_user_role)