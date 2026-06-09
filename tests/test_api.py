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
    ct = res.headers.get("content-type", "")
    if "application/json" in ct:
        # No SPA build present: root serves the API info document.
        body = res.json()
        assert body["name"]
        assert body["version"]
    else:
        # SPA build present (production image): root serves index.html.
        assert "text/html" in ct


def test_unknown_api_path_returns_404(client: TestClient):
    # Unknown API routes must return a JSON 404 -- never the SPA shell -- in
    # both modes (no SPA build, or SPA build with the catch-all installed).
    res = client.get("/api/v1/definitely-not-a-real-endpoint")
    assert res.status_code == 404
