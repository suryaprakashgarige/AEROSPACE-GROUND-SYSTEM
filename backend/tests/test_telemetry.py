# backend/tests/test_telemetry.py
from fastapi import status

def test_get_satellites_authorized(client):
    # Authenticate
    login_response = client.post(
        "/api/v1/auth/token",
        data={"username": "viewer", "password": "viewer123"}
    )
    token = login_response.json()["access_token"]
    
    # Get satellites list
    response = client.get(
        "/api/v1/telemetry/satellites",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) > 0
    assert response.json()[0]["id"] == "SAT-001"

def test_get_latest_telemetry_authorized(client):
    # Authenticate
    login_response = client.post(
        "/api/v1/auth/token",
        data={"username": "viewer", "password": "viewer123"}
    )
    token = login_response.json()["access_token"]
    
    # Get latest telemetry
    response = client.get(
        "/api/v1/telemetry/latest",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == status.HTTP_200_OK
    # May return empty if simulation loop hasn't run yet, but the endpoint must return a list
    assert isinstance(response.json(), list)
