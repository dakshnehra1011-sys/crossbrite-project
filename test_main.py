from fastapi.testclient import TestClient
from main import app
import jwt
from dependencies import SECRET_KEY, ALGORITHM

client = TestClient(app)

def get_auth_headers(user_id: int, role: str):
    token = jwt.encode({"sub": str(user_id), "role": role}, SECRET_KEY, algorithm=ALGORITHM)
    return {"Authorization": f"Bearer {token}"}

def test_create_session_as_teacher():
    response = client.post(
        "/sessions/",
        headers=get_auth_headers(1, "teacher"),
        json={"title": "Data Structures", "description": "Arrays and Strings"}
    )
    assert response.status_code == 201
    assert response.json()["title"] == "Data Structures"

def test_create_session_as_parent_forbidden():
    response = client.post(
        "/sessions/",
        headers=get_auth_headers(2, "parent"),
        json={"title": "Maths", "description": "Calculus"}
    )
    assert response.status_code == 403

def test_get_sessions_as_teacher():
    response = client.get(
        "/sessions/",
        headers=get_auth_headers(1, "teacher")
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_sessions_as_admin():
    response = client.get(
        "/sessions/",
        headers=get_auth_headers(99, "admin")
    )
    assert response.status_code == 200

def test_delete_session_unauthorized():
    response = client.delete(
        "/sessions/999",
        headers=get_auth_headers(2, "parent")
    )
    assert response.status_code in [403, 404]

def test_evaluate_session_endpoint():
    response = client.post(
        "/sessions/1/evaluate",
        headers=get_auth_headers(1, "teacher")
    )
    assert response.status_code in [202, 404]