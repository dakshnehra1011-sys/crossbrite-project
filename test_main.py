from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_create_session_as_teacher():
    response = client.post(
        "/sessions/",
        headers={"x-user-id": "1", "x-user-role": "teacher"},
        json={"title": "Data Structures", "description": "Arrays and Strings"}
    )
    assert response.status_code == 201
    assert response.json()["title"] == "Data Structures"

def test_create_session_as_parent_forbidden():
    response = client.post(
        "/sessions/",
        headers={"x-user-id": "2", "x-user-role": "parent"},
        json={"title": "Maths", "description": "Calculus"}
    )
    assert response.status_code == 403

def test_get_sessions_as_teacher():
    response = client.get(
        "/sessions/",
        headers={"x-user-id": "1", "x-user-role": "teacher"}
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_sessions_as_admin():
    response = client.get(
        "/sessions/",
        headers={"x-user-id": "99", "x-user-role": "admin"}
    )
    assert response.status_code == 200

def test_delete_session_unauthorized():
    response = client.delete(
        "/sessions/999",
        headers={"x-user-id": "2", "x-user-role": "parent"}
    )
    assert response.status_code in [403, 404]

def test_evaluate_session_endpoint():
    response = client.post(
        "/sessions/1/evaluate",
        headers={"x-user-id": "1", "x-user-role": "teacher"}
    )
    assert response.status_code in [202, 404]