# Architecture Note

### 1. Why this schema shape, and what normalization trade-offs were made.
For this project, we chose PostgreSQL because our data is naturally highly relational. A `Session` belongs to a specific `User` (the teacher). We used a strictly normalized approach for core entities:
- `teacher_id` as a foreign key in `sessions` ensures sessions are cleanly tied to their creators.
- We implemented an `Enrollment` join table to handle the many-to-many relationship between `Student` and `Session`. 
- `Evaluations` are stored in a separate table linked via a one-to-one/one-to-many pattern to `sessions`, ensuring that heavy evaluation text and scores don't bloat the main `sessions` table.

The main trade-off we made was with the user `role`. Instead of creating a separate complicated `Roles` table and linking it, we simply saved the role as a Python Enum (admin, teacher, parent) directly inside the `users` table. This denormalization makes our authorization logic significantly simpler and keeps database queries fast by avoiding unnecessary JOIN operations on every authenticated request.

### 2. How the RBAC approach would need to change to support a fourth role, or nested organizations.
Right now, our Role-Based Access Control (RBAC) relies on decoding the JWT token inside `dependencies.py` and validating the role enum. If we want to add a fourth role (like 'Principal'), we just need to add it to the `RoleEnum` and update the dependency checks in our FastAPI routes.

If we want to support nested organizations (e.g., multiple Schools or Districts), we would need a multi-tenant architecture:
1. Create an `Organization` (or `School`) table.
2. Add an `org_id` column as a foreign key to the `users`, `sessions`, and `students` tables.
3. When generating the JWT token at login, include this `org_id` in the token payload.
4. Update our API endpoints to automatically filter all database queries by the `org_id` present in the user's token, ensuring strict data isolation between schools (Row-Level Security in PostgreSQL could also be used here for added safety).

### 3. What's missing for this to be production-safe (migrations strategy, secrets handling, etc.).
While this project is a robust MVP—featuring full Dockerization and a GitHub Actions CI pipeline for automated testing and linting—it needs the following for true production readiness:

- **Database Migrations:** Currently, we rely on `Base.metadata.create_all` which cannot alter existing tables safely. We must integrate **Alembic** to manage schema migrations incrementally without data loss.
- **Secrets Management:** The JWT `SECRET_KEY` and database credentials are currently hardcoded or passed via basic Docker environment variables. In production, these should be injected securely using a Vault (like AWS Secrets Manager or HashiCorp Vault) and strictly excluded from the codebase.
- **Production Web Server & SSL:** The FastAPI app currently runs on a development server (Uvicorn). It needs to sit behind a robust reverse proxy like **Nginx** or **Traefik**, configured with SSL/TLS certificates to enforce HTTPS encryption.
- **Rate Limiting:** To prevent abuse, we should implement API rate limiting (e.g., using Redis) on sensitive endpoints like login and evaluation triggers.
