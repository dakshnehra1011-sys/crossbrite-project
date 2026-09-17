# Architecture Note

### 1. Why this schema shape, and what normalization trade-offs were made.
For this project, we chose PostgreSQL because our data is naturally connected. A `Session` belongs to a specific `User` (the teacher). We used a normalized approach by adding `teacher_id` as a foreign key in the `sessions` table. This ensures that data is linked properly, and if a teacher is deleted, their sessions can be managed easily without leaving orphan data behind. 

The main trade-off we made was with the user `role`. Instead of creating a separate complicated `Roles` table and linking it, we simply saved the role as a text string (admin, teacher, parent) directly inside the `users` table. This makes our code much simpler and makes database queries faster because we don't have to join two tables every time a user logs in.

### 2. How the RBAC approach would need to change to support a fourth role, or nested organizations.
Right now, our Role-Based Access Control (RBAC) uses a simple Python `Enum` (admin, teacher, parent). If we want to add a fourth role like 'Principal' or 'Student', we just need to add that new word to our Enum list and check for it in our API routes.

If we want to support nested organizations (like multiple Schools, where each school has its own teachers and parents), we would need to do two simple things:
1. Add a `school_id` column to the `users` table.
2. When generating the JWT token at login, include this `school_id` inside the token. 
This way, when a teacher requests to see their sessions, the backend will check the token and only return data that matches their specific `school_id`, keeping different schools completely separate.

### 3. What's missing for this to be production-safe (migrations strategy, secrets handling, etc.).
This project is a strong MVP (Minimum Viable Product), but to put it live on the real internet safely, we would need to add three things:

- **Database Migrations:** Right now, we use a simple SQLAlchemy command to create tables automatically. For a real production app, we should use a tool like **Alembic**. Alembic safely upgrades the database without losing old data if we ever need to add new columns in the future.
- **Secrets Handling:** Our JWT `SECRET_KEY` and database passwords are currently written directly in the code or docker files. In production, we must hide these using `.env` (environment variables) files so that passwords never get uploaded to GitHub.
- **Production Web Server:** Right now, FastAPI is using a testing server. For real-world traffic, it should run behind a more powerful server like **Nginx** with an SSL certificate to ensure HTTPS encryption (the green padlock in the browser).
