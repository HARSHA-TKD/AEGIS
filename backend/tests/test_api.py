import time

from fastapi.testclient import TestClient

from app.main import app

EMAIL = "operator@aegis.dev"
PASSWORD = "aegis-demo-2026"


def login(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


def test_public_health_has_request_id() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["X-Request-ID"]


def test_authenticated_system_endpoints() -> None:
    with TestClient(app) as client:
        headers = login(client)
        for path in (
            "/api/dashboard",
            "/api/health",
            "/api/audit",
            "/api/notifications",
            "/api/reports/trends",
            "/api/reports/schedules",
            "/api/intel/filters",
        ):
            response = client.get(path, headers=headers)
            assert response.status_code == 200, (path, response.text)
            assert response.headers["X-Request-ID"]


def test_intel_filter_lifecycle() -> None:
    with TestClient(app) as client:
        headers = login(client)
        created = client.post(
            "/api/intel/filters",
            headers=headers,
            json={"name": "pytest critical", "query": "log4j", "severity": "critical", "sort": "epss"},
        )
        assert created.status_code == 201, created.text
        filter_id = created.json()["id"]
        applied = client.get(f"/api/intel?filterId={filter_id}", headers=headers)
        assert applied.status_code == 200
        deleted = client.delete(f"/api/intel/filters/{filter_id}", headers=headers)
        assert deleted.status_code == 204


def test_report_schedule_lifecycle() -> None:
    with TestClient(app) as client:
        headers = login(client)
        created = client.post(
            "/api/reports/schedules",
            headers=headers,
            json={"name": "pytest weekly", "scope": "All repositories", "kind": "custom", "intervalHours": 168},
        )
        assert created.status_code == 201, created.text
        schedule_id = created.json()["id"]
        paused = client.patch(f"/api/reports/schedules/{schedule_id}?active=false", headers=headers)
        assert paused.status_code == 200
        assert paused.json()["active"] is False
        deleted = client.delete(f"/api/reports/schedules/{schedule_id}", headers=headers)
        assert deleted.status_code == 204


def test_login_creates_local_demo_account() -> None:
    email = f"pytest-{time.time_ns()}@example.com"
    payload = {"email": email, "password": "demo-pass-123"}
    with TestClient(app) as client:
        first = client.post("/api/auth/login", json=payload)
        assert first.status_code == 200, first.text
        assert first.json()["user"]["email"] == email
        second = client.post("/api/auth/login", json=payload)
        assert second.status_code == 200
        assert first.json()["user"]["id"] == second.json()["user"]["id"]


def test_report_export_formats() -> None:
    with TestClient(app) as client:
        headers = login(client)
        created = client.post(
            "/api/reports",
            headers=headers,
            json={"name": "pytest export", "scope": "All repositories", "kind": "custom"},
        )
        assert created.status_code == 201, created.text
        report_id = created.json()["id"]
        try:
            csv = client.get(f"/api/reports/{report_id}/export?format=csv", headers=headers)
            html = client.get(f"/api/reports/{report_id}/export?format=html", headers=headers)
            assert csv.status_code == 200
            assert "text/csv" in csv.headers["content-type"]
            assert html.status_code == 200
            assert "text/html" in html.headers["content-type"]
        finally:
            client.delete(f"/api/reports/{report_id}", headers=headers)
