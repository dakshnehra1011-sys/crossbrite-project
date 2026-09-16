from fastapi import Header, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt

SECRET_KEY = "super_secret_key"
ALGORITHM = "HS256"

security = HTTPBearer()

class CurrentUser(BaseModel):
    id: int
    role: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = int(payload.get("sub"))
        role: str = payload.get("role")
        if user_id is None or role is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return CurrentUser(id=user_id, role=role)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")