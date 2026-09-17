from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import jwt
from passlib.context import CryptContext

from database import engine, get_db
import models
import schemas
from dependencies import get_current_user, CurrentUser, SECRET_KEY, ALGORITHM
from redis_client import trigger_evaluation_task

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

models.Base.metadata.create_all(bind=engine)

with Session(engine) as db_session:
    if not db_session.query(models.User).filter(models.User.id == 1).first():
        admin_pwd = pwd_context.hash("admin")
        db_session.add(models.User(id=1, username="admin_superuser", hashed_password=admin_pwd, role=models.RoleEnum.admin, is_approved=True))
        db_session.commit()

app = FastAPI(title="Crossbrite Evaluation Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

class AuthRequest(BaseModel):
    user_id: int
    password: str

class SignupRequest(BaseModel):
    name: str
    password: str
    role: str
    student_name: Optional[str] = None
    student_roll: Optional[str] = None

@app.post("/signup", tags=["Authentication"])
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    db_username = f"{request.name}_{random.randint(10000, 99999)}"
    hashed_pwd = pwd_context.hash(request.password)
    
    new_user = models.User(username=db_username, hashed_password=hashed_pwd, role=request.role, is_approved=False)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    if request.role == "parent" and request.student_name and request.student_roll:
        student = db.query(models.Student).filter(
            models.Student.name == request.student_name,
            models.Student.roll_no == request.student_roll
        ).first()
        
        if not student:
            db.delete(new_user)
            db.commit()
            raise HTTPException(status_code=400, detail="Student not found. Please check school records.")
            
        if student.parent_id is not None:
            db.delete(new_user)
            db.commit()
            raise HTTPException(status_code=400, detail="This student is already linked to a parent.")
            
        student.parent_id = new_user.id
        db.commit()
    
    return {"id": new_user.id, "username": request.name, "role": new_user.role}

@app.post("/login", tags=["Authentication"])
def login(request: AuthRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User ID not found. Please check your ID.")
    
    if not pwd_context.verify(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Account pending admin approval.")
    
    display_name = user.username.split('_')[0] if '_' in user.username else user.username
    token = jwt.encode({"sub": str(user.id), "role": user.role.value}, SECRET_KEY, algorithm=ALGORITHM)
    
    response_data = {"id": user.id, "username": display_name, "role": user.role, "token": token}
    
    if user.role.value == "parent":
        student = db.query(models.Student).filter(models.Student.parent_id == user.id).first()
        if student:
            response_data["student_name"] = student.name
            response_data["student_roll"] = student.roll_no
            
    return response_data

@app.post("/sessions/", response_model=schemas.SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(session_in: schemas.SessionCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create sessions")
    new_session = models.Session(title=session_in.title, description=session_in.description, teacher_id=current_user.id)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    if session_in.student_ids:
        for sid in session_in.student_ids:
            enrollment = models.Enrollment(student_id=sid, session_id=new_session.id)
            db.add(enrollment)
        db.commit()
        
    return new_session

@app.get("/students", response_model=List[schemas.StudentResponse])
def get_students(db: Session = Depends(get_db)):
    return db.query(models.Student).all()

@app.get("/sessions/", response_model=List[schemas.SessionResponse])
def get_sessions(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    if current_user.role == "admin":
        return db.query(models.Session).all()
    elif current_user.role == "teacher":
        return db.query(models.Session).filter(models.Session.teacher_id == current_user.id).all()
    elif current_user.role == "parent":
        students = db.query(models.Student).filter(models.Student.parent_id == current_user.id).all()
        student_ids = [s.id for s in students]
        if not student_ids:
            return []
        enrollments = db.query(models.Enrollment).filter(models.Enrollment.student_id.in_(student_ids)).all()
        session_ids = [e.session_id for e in enrollments]
        return db.query(models.Session).filter(models.Session.id.in_(session_ids)).all()
    return []

@app.get("/sessions/{session_id}", response_model=schemas.SessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if current_user.role == "teacher" and db_session.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this session")
    elif current_user.role == "parent":
        student_ids = [s.id for s in db.query(models.Student).filter(models.Student.parent_id == current_user.id).all()]
        if not db.query(models.Enrollment).filter(models.Enrollment.student_id.in_(student_ids), models.Enrollment.session_id == session_id).first():
            raise HTTPException(status_code=403, detail="Not authorized to view this session")
            
    return db_session

@app.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Only admins or teachers can delete sessions")
        
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if current_user.role == "teacher" and db_session.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this session")
    db.delete(db_session)
    db.commit()
    return None

@app.put("/sessions/{session_id}", response_model=schemas.SessionResponse)
def update_session(session_id: int, session_in: schemas.SessionUpdate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Only teachers and admins can update sessions")
    
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if current_user.role == "teacher" and db_session.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this session")

    if session_in.title is not None:
        db_session.title = session_in.title
    if session_in.description is not None:
        db_session.description = session_in.description
        
    db.commit()
    db.refresh(db_session)
    return db_session

@app.post("/sessions/{session_id}/evaluate", status_code=status.HTTP_202_ACCEPTED)
def trigger_evaluation(session_id: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can trigger evaluations")
        
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if db_session.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to evaluate this session")
    
    existing_eval = db.query(models.Evaluation).filter(models.Evaluation.session_id == session_id).first()
    if not existing_eval:
        mock_eval = models.Evaluation(
            session_id=session_id, status="AI Evaluated", score=95,
            feedback="Excellent grasp of the concepts! (This is a database placeholder until Groq is connected)."
        )
        db.add(mock_eval)
        db.commit()
    
    trigger_evaluation_task(session_id)
    return {"message": "Evaluation job enqueued", "session_id": session_id}

@app.get("/users/pending")
def get_pending_users(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view pending users")
    users = db.query(models.User).filter(models.User.is_approved == False).all()
    return [{"id": u.id, "username": u.username.split('_')[0] if '_' in u.username else u.username, "role": u.role} for u in users]

@app.post("/users/{user_id}/approve")
def approve_user(user_id: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can approve users")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_approved = True
    db.commit()
    return {"message": "User approved successfully"}

@app.get("/users", response_model=List[schemas.UserResponse])
def get_all_users(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view all users")
    return db.query(models.User).filter(models.User.role != models.RoleEnum.admin).all()

@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete users")
        
    user_to_delete = db.query(models.User).filter(models.User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_to_delete.role == models.RoleEnum.parent:
        db.query(models.Student).filter(models.Student.parent_id == user_id).update({"parent_id": None})
    elif user_to_delete.role == models.RoleEnum.teacher:
        sessions = db.query(models.Session).filter(models.Session.teacher_id == user_id).all()
        for session in sessions:
            db.delete(session)
            
    db.delete(user_to_delete)
    db.commit()
    return None

@app.put("/users/{user_id}/password")
def change_user_password(user_id: int, pwd_in: schemas.PasswordChange, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can change passwords")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.hashed_password = pwd_context.hash(pwd_in.new_password)
    db.commit()
    return {"message": "Password updated successfully"}

@app.post("/sessions/{session_id}/students/{student_id}")
def admin_add_student(session_id: int, student_id: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage enrollments directly here")
        
    existing = db.query(models.Enrollment).filter_by(session_id=session_id, student_id=student_id).first()
    if not existing:
        db.add(models.Enrollment(session_id=session_id, student_id=student_id))
        db.commit()
    return {"message": "Student enrolled"}

@app.delete("/sessions/{session_id}/students/{student_id}")
def admin_remove_student(session_id: int, student_id: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage enrollments directly here")
        
    existing = db.query(models.Enrollment).filter_by(session_id=session_id, student_id=student_id).first()
    if existing:
        db.delete(existing)
        db.commit()
    return {"message": "Student removed"}

@app.get("/sessions/{session_id}/students")
def get_session_students(session_id: int, db: Session = Depends(get_db)):
    enrollments = db.query(models.Enrollment).filter(models.Enrollment.session_id == session_id).all()
    return [e.student_id for e in enrollments]