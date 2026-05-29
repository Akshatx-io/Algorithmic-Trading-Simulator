"""Smoke tests for the running app.

Phase 2.7 expands this to a real pyramid (domain unit tests + service
integration + ws protocol). For now, just verify the app boots and the
health endpoint shape matches the contract.
"""

from fastapi.testclient import TestClient


def test_health(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert body["database"] == "connected"
    assert body["environment"]
    assert body["version"]


def test_root(client: TestClient):
    res = client.get("/")
    assert res.status_code == 200
    body = res.json()
    assert body["name"]
    assert body["version"]


def test_unknown_path_returns_404(client: TestClient):
    res = client.get("/definitely-not-a-real-endpoint")
    assert res.status_code == 404
