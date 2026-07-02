# backend/tests/test_auth.py
from fastapi import status

def test_login_success(client):
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_failed(client):
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "admin", "password": "wrong_password"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

def test_read_users_me_unauthorized(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

def test_read_users_me_authorized(client):
    # Login first
    login_response = client.post(
        "/api/v1/auth/token",
        data={"username": "admin", "password": "admin123"}
    )
    token = login_response.json()["access_token"]
    
    # Access endpoint
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["username"] == "admin"
    assert response.json()["role"] == "Administrator"
