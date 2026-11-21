from fastapi.testclient import TestClient

from app.main import app


def test_health_ok():
    r = TestClient(app).get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in {"ok", "degraded"}
    assert "data_mode" in body
