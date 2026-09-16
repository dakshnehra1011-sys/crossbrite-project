from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import engine, get_db
import models
import schemas
from dependencies import get_current_user, CurrentUser
from redis_client import trigger_evaluation_task

models.Base.metadata.create_all(bind=engine)

with Session(engine) as db_session:
    if not db_session.query(models.User).filter(models.User.id == 1).first():
        db_session.add(models.User(id=1, username="test_teacher", role=models.RoleEnum.teacher))
        db_session.commit()

tags_metadata = [
    {
        "name": "Sessions Management",
        "description": "Endpoints for creating, reading, and deleting educational sessions. Strictly protected by RBAC.",
    },
    {
        "name": "AI Evaluations",
        "description": "Background jobs for processing sessions asynchronously via Redis.",
    },
]

app = FastAPI(
    title="Crossbrite Evaluation Service",
    description="A robust microservice for managing educational sessions with Role-Based Access Control (RBAC) and asynchronous AI evaluations.",
    version="1.0.0",
    openapi_tags=tags_metadata
)

@app.post("/sessions/", response_model=schemas.SessionResponse, status_code=status.HTTP_201_CREATED, tags=["Sessions Management"], summary="Create a new Session", description="Allows a teacher to create a new class session. Only accessible if the user role is 'teacher'.")
def create_session(
    session_in: schemas.SessionCreate, 
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create sessions")
        
    new_session = models.Session(
        title=session_in.title,
        description=session_in.description,
        teacher_id=current_user.id
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@app.get("/sessions/", response_model=List[schemas.SessionResponse], tags=["Sessions Management"], summary="Get all Sessions", description="Fetches sessions based on user role. Admins can see all sessions globally, while teachers can only see their own sessions.")
def get_sessions(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    if current_user.role == "admin":
        return db.query(models.Session).all()
    elif current_user.role == "teacher":
        return db.query(models.Session).filter(models.Session.teacher_id == current_user.id).all()
    else:
        return []

@app.get("/sessions/{session_id}", response_model=schemas.SessionResponse, tags=["Sessions Management"], summary="Get a specific Session", description="Fetch details of a single session by its unique ID. Enforces strict RBAC to prevent unauthorized access.")
def get_session(
    session_id: int, 
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if current_user.role == "teacher" and db_session.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this session")
        
    return db_session

@app.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Sessions Management"], summary="Delete a Session", description="Allows admins or the owning teacher to delete a session permanently from the database.")
def delete_session(
    session_id: int, 
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if current_user.role != "admin" and (current_user.role != "teacher" or db_session.teacher_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this session")
        
    db.delete(db_session)
    db.commit()
    return None

@app.post("/sessions/{session_id}/evaluate", status_code=status.HTTP_202_ACCEPTED, tags=["AI Evaluations"], summary="Trigger Background Evaluation", description="Enqueues an asynchronous background task in Redis to evaluate the session. Returns a 202 Accepted response instantly without blocking the main thread.")
def trigger_evaluation(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if current_user.role != "admin" and (current_user.role != "teacher" or db_session.teacher_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to evaluate this session")
    
    try:
        trigger_evaluation_task(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not connect to Redis queue")
        
    return {"message": "Evaluation job enqueued successfully", "session_id": session_id}