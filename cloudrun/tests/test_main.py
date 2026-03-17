"""Integration tests for the FastAPI application."""
import pytest
from unittest.mock import patch, AsyncMock

from app.config import Settings, get_settings
from app.main import APIKeyMiddleware
import app.main as main_module


FAKE_SETTINGS = Settings(
    litellm_master_key="sk-master",
    litellm_url="https://litellm.example.com",
    api_key="test-api-key",
)


def override_settings():
    return FAKE_SETTINGS


from fastapi.testclient import TestClient
from app.main import app as _app

_app.dependency_overrides[get_settings] = override_settings

for middleware in _app.user_middleware:
    if middleware.cls is APIKeyMiddleware:
        middleware.kwargs["settings_factory"] = override_settings

client = TestClient(_app)

VALID_API_KEY_HEADER = {"X-API-Key": "test-api-key"}


class TestHealthEndpoint:
    def test_returns_200_without_api_key(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestAPIKeyMiddleware:
    def test_rejects_request_with_no_api_key(self):
        response = client.post("/key", headers={"Authorization": "Bearer token"})
        assert response.status_code == 401
        assert "API key" in response.json()["detail"]

    def test_rejects_request_with_wrong_api_key(self):
        response = client.post("/key", headers={
            "Authorization": "Bearer token",
            "X-API-Key": "wrong-key",
        })
        assert response.status_code == 401

    def test_allows_request_with_correct_api_key(self):
        claims = {"email": "alice@corp.com", "sub": "uid-123"}
        with (
            patch("app.main.verify_google_token", return_value=claims),
            patch("app.main.get_key", new=AsyncMock(return_value="sk-existing")),
        ):
            response = client.post("/key", headers={
                "Authorization": "Bearer valid.token",
                **VALID_API_KEY_HEADER,
            })
        assert response.status_code == 200


class TestGenerateKey:
    VALID_CLAIMS = {"email": "alice@corp.com", "sub": "uid-123"}

    def _post_with_token(self, token: str = "valid.token"):
        return client.post("/key", headers={
            "Authorization": f"Bearer {token}",
            **VALID_API_KEY_HEADER,
        })

    def test_returns_existing_key_from_db(self):
        with (
            patch("app.main.verify_google_token", return_value=self.VALID_CLAIMS),
            patch("app.main.get_key", new=AsyncMock(return_value="sk-existing")),
        ):
            response = self._post_with_token()
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == "sk-existing"
        assert data["email"] == "alice@corp.com"

    def test_creates_and_saves_key_when_not_in_db(self):
        teams = [{"team_alias": "corp.com", "team_id": "team-1"}]
        with (
            patch("app.main.verify_google_token", return_value=self.VALID_CLAIMS),
            patch("app.main.get_key", new=AsyncMock(return_value=None)),
            patch("app.main.get_teams", new=AsyncMock(return_value=teams)),
            patch("app.main.create_virtual_key", new=AsyncMock(return_value="sk-new")),
            patch("app.main.save_key", new=AsyncMock()) as mock_save,
        ):
            response = self._post_with_token()
        assert response.status_code == 200
        assert response.json()["key"] == "sk-new"
        mock_save.assert_awaited_once_with("alice@corp.com", "sk-new")

    def test_rejects_missing_authorization_header(self):
        response = client.post("/key", headers=VALID_API_KEY_HEADER)
        assert response.status_code == 422

    def test_rejects_malformed_authorization_header(self):
        response = client.post("/key", headers={
            "Authorization": "token-without-bearer",
            **VALID_API_KEY_HEADER,
        })
        assert response.status_code == 401

    def test_rejects_invalid_google_token(self):
        from fastapi import HTTPException
        with patch("app.main.verify_google_token", side_effect=HTTPException(status_code=401, detail="bad token")):
            response = self._post_with_token("bad.token")
        assert response.status_code == 401

    def test_rejects_unauthorized_domain(self):
        claims = {"email": "user@outsider.io", "sub": "uid-999"}
        teams = [{"team_alias": "corp.com", "team_id": "team-1"}]
        with (
            patch("app.main.verify_google_token", return_value=claims),
            patch("app.main.get_key", new=AsyncMock(return_value=None)),
            patch("app.main.get_teams", new=AsyncMock(return_value=teams)),
        ):
            response = self._post_with_token()
        assert response.status_code == 401

    def test_propagates_litellm_502_error(self):
        from fastapi import HTTPException
        teams = [{"team_alias": "corp.com", "team_id": "team-1"}]
        with (
            patch("app.main.verify_google_token", return_value=self.VALID_CLAIMS),
            patch("app.main.get_key", new=AsyncMock(return_value=None)),
            patch("app.main.get_teams", new=AsyncMock(return_value=teams)),
            patch("app.main.create_virtual_key", new=AsyncMock(side_effect=HTTPException(status_code=502, detail="LiteLLM down"))),
        ):
            response = self._post_with_token()
        assert response.status_code == 502
