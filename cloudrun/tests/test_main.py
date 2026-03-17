"""Integration tests for the FastAPI application."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

from app.config import Settings, get_settings
from app.main import APIKeyMiddleware
import app.main as main_module


FAKE_SETTINGS = Settings(
    litellm_master_key="sk-master",
    litellm_url="https://litellm.example.com",
    whitelist_domains=["corp.com", "partner.org"],
    api_key="test-api-key",
)


def override_settings():
    return FAKE_SETTINGS


# Build a test app with the fake settings injected into the middleware
from app.main import app as _app
_app.dependency_overrides[get_settings] = override_settings

# Patch the middleware's settings factory on the existing middleware instance
for layer in _app.middleware_stack.__class__.__mro__:
    pass  # just importing; actual patch done below

# Re-create a fresh test client; patch via middleware settings_factory attribute
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
            patch("app.main.create_virtual_key", new=AsyncMock(return_value="sk-xyz")),
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

    def test_returns_key_for_whitelisted_user(self):
        with (
            patch("app.main.verify_google_token", return_value=self.VALID_CLAIMS),
            patch("app.main.create_virtual_key", new=AsyncMock(return_value="sk-virtual-xyz")),
        ):
            response = self._post_with_token()
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == "sk-virtual-xyz"
        assert data["email"] == "alice@corp.com"

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

    def test_returns_403_for_non_whitelisted_domain(self):
        claims = {"email": "user@outsider.io", "sub": "uid-999"}
        with patch("app.main.verify_google_token", return_value=claims):
            response = self._post_with_token()
        assert response.status_code == 403

    def test_passes_correct_email_to_litellm(self):
        with (
            patch("app.main.verify_google_token", return_value=self.VALID_CLAIMS),
            patch("app.main.create_virtual_key", new=AsyncMock(return_value="sk-new")) as mock_create,
        ):
            self._post_with_token()
        mock_create.assert_awaited_once_with(
            litellm_url=FAKE_SETTINGS.litellm_url,
            master_key=FAKE_SETTINGS.litellm_master_key,
            email="alice@corp.com",
        )

    def test_propagates_litellm_502_error(self):
        from fastapi import HTTPException
        with (
            patch("app.main.verify_google_token", return_value=self.VALID_CLAIMS),
            patch("app.main.create_virtual_key", new=AsyncMock(side_effect=HTTPException(status_code=502, detail="LiteLLM down"))),
        ):
            response = self._post_with_token()
        assert response.status_code == 502
