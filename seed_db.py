import random
from sqlalchemy.orm import Session
from database import engine
import models

def seed_data():
    with Session(engine) as db:
        # Clear existing students and enrollments to prevent duplicates if run multiple times
        db.query(models.Enrollment).delete()
        db.query(models.Student).delete()
        db.commit()

        # Get existing sessions to enroll students into
        sessions = db.query(models.Session).all()
        session_ids = [s.id for s in sessions]
        
        print(f"Found {len(session_ids)} sessions: {session_ids}")

        print("Seeding 50 students...")
        for i in range(1, 51):
            name = f"Student {i}"
            roll_no = f"R{i:03d}"  # R001, R002, etc.
            
            student = models.Student(name=name, roll_no=roll_no, parent_id=None)
            db.add(student)
            db.commit()
            db.refresh(student)
            
            # Enroll the student in 1 to 3 random sessions (if sessions exist)
            if session_ids:
                num_enrollments = random.randint(1, min(3, len(session_ids)))
                enrolled_sessions = random.sample(session_ids, num_enrollments)
                
                for s_id in enrolled_sessions:
                    enrollment = models.Enrollment(student_id=student.id, session_id=s_id)
                    db.add(enrollment)
                db.commit()
        
        print("Successfully seeded 50 students and their enrollments!")

if __name__ == "__main__":
    seed_data()
