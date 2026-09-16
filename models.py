from sqlalchemy import Column, Integer, String, ForeignKey, Enum, Text, DateTime, Boolean
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from database import Base


class RoleEnum(str, enum.Enum):
    admin = "admin"
    teacher = "teacher"
    parent = "parent"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    is_approved = Column(Boolean, default=False)

    # Relationships (A teacher has multiple sessions)
    sessions = relationship("Session", back_populates="teacher")
    
    # Relationships (A parent has multiple students)
    students = relationship("Student", back_populates="parent")

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("users.id"))
    
    parent = relationship("User", back_populates="students")
    enrollments = relationship("Enrollment", back_populates="student", cascade="all, delete-orphan")

class Enrollment(Base):
    __tablename__ = "enrollments"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    session_id = Column(Integer, ForeignKey("sessions.id"))
    
    student = relationship("Student", back_populates="enrollments")
    session = relationship("Session", back_populates="enrollments")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    
    teacher_id = Column(Integer, ForeignKey("users.id"))
    
    teacher = relationship("User", back_populates="sessions")
    evaluations = relationship("Evaluation", back_populates="session", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="session", cascade="all, delete-orphan")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    status = Column(String, default="pending")  # Example: pending, completed
    score = Column(Integer, nullable=True)
    feedback = Column(Text, nullable=True)

  
    session = relationship("Session", back_populates="evaluations")