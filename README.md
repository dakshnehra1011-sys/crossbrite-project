# Crossbrite Educational Platform

## Overview
Crossbrite is a comprehensive, full-stack educational platform built to meet stringent assessment requirements. It features a strict **Role-Based Access Control (RBAC)** system (Admin, Teacher, Parent), session management, student enrollment tracking, and asynchronous processing. 

The application is fully containerized end-to-end, includes automated CI/CD pipelines via GitHub Actions, and uses a sleek, professional UI optimized for desktop experiences.

## Tech Stack
- **Backend API**: FastAPI (Python)
- **Database**: PostgreSQL (Ensuring ACID compliance and relational data integrity)
- **Queue/Broker**: Redis (For asynchronous evaluation tasks)
- **Frontend**: React.js with Vite (Custom styled with a modern, professional CSS architecture)
- **Infrastructure**: Docker & Docker Compose
- **CI/CD**: GitHub Actions (Linting with `flake8` and automated testing with `pytest`)

## Key Features
- **Superuser (Admin) Management**: Admins have God-mode access to approve pending users, delete accounts, force-change passwords, and manage enrollments across any session.
- **Teacher Workflow**: Teachers can create new sessions, select students to enroll directly from the portal, and trigger asynchronous evaluations on their active sessions.
- **Parent Portal**: Parents have a read-only, secure view of their specific child's active enrollments, scores, and evaluation feedback.
- **Automated CI**: Every commit triggers a GitHub Actions workflow that lints the codebase and runs automated unit tests to ensure API stability.

---

## Setup & Run Instructions

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/) installed and running.
- [Node.js & npm](https://nodejs.org/) installed (for running the frontend locally).

### 1. Start the Backend Infrastructure
The backend API, PostgreSQL database, and Redis cache are entirely dockerized. To start the environment, run the following command from the root directory:

```bash
docker-compose up -d --build
```

This command will spin up three containers:
- **`api`**: The FastAPI backend server available at `http://localhost:8000`.
- **`db`**: PostgreSQL database exposed on port `5433` (mapped from 5432 to avoid local conflicts).
- **`redis`**: Redis instance running on port `6379`.

*You can view the interactive Swagger API documentation at: [http://localhost:8000/docs](http://localhost:8000/docs)*

### 2. Seed the Database (Optional but Recommended)
To populate the database with initial dummy data (students, and standard roles), run the seed script:
```bash
docker exec -it crossbrite-api-1 python seed_db.py
```

### 3. Start the Frontend Application
Open a new terminal, navigate to the `frontend` directory, and start the Vite development server:

```bash
cd frontend
npm install
npm run dev
```

The frontend application will now be available locally at [http://localhost:5173](http://localhost:5173).

---

## Testing the Application

### Default Credentials
If you ran the `seed_db.py` script, you can use the following default credentials to test the various RBAC views:

| Role | Username / ID | Password |
| :--- | :--- | :--- |
| **Admin** | `admin` (or ID: `1`) | `admin` |

### Running Automated Tests
The repository includes a suite of automated tests (`test_main.py`). These run automatically on GitHub Actions, but you can also run them locally inside the docker container:

```bash
docker exec -it crossbrite-api-1 pytest test_main.py -v
```
