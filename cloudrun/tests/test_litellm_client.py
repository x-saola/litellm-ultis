"""Unit tests for LiteLLM client module."""
import pytest
import httpx
import respx
from fastapi import HTTPException

from app.litellm_client import create_virtual_key

LITELLM_URL = "https://litellm.example.com"
MASTER_KEY = "sk-master"
EMAIL = "alice@corp.com"


@pytest.mark.asyncio
class TestCreateVirtualKey:
    @respx.mock
    async def test_returns_key_on_success(self):
        respx.post(f"{LITELLM_URL}/key/generate").mock(
            return_value=httpx.Response(200, json={"key": "sk-virtual-abc123"})
        )
        key = await create_virtual_key(LITELLM_URL, MASTER_KEY, EMAIL)
        assert key == "sk-virtual-abc123"

    @respx.mock
    async def test_sends_correct_payload(self):
        route = respx.post(f"{LITELLM_URL}/key/generate").mock(
            return_value=httpx.Response(200, json={"key": "sk-test"})
        )
        await create_virtual_key(LITELLM_URL, MASTER_KEY, EMAIL, budget_usd=200.0)

        request = route.calls.last.request
        import json
        body = json.loads(request.content)
        assert body["key_alias"] == EMAIL
        assert body["max_budget"] == 200.0
        assert body["budget_duration"] == "monthly"

    @respx.mock
    async def test_sends_master_key_in_auth_header(self):
        route = respx.post(f"{LITELLM_URL}/key/generate").mock(
            return_value=httpx.Response(200, json={"key": "sk-test"})
        )
        await create_virtual_key(LITELLM_URL, MASTER_KEY, EMAIL)

        request = route.calls.last.request
        assert request.headers["Authorization"] == f"Bearer {MASTER_KEY}"

    @respx.mock
    async def test_raises_502_on_litellm_error(self):
        respx.post(f"{LITELLM_URL}/key/generate").mock(
            return_value=httpx.Response(500, text="Internal Server Error")
        )
        with pytest.raises(HTTPException) as exc_info:
            await create_virtual_key(LITELLM_URL, MASTER_KEY, EMAIL)
        assert exc_info.value.status_code == 502

    @respx.mock
    async def test_raises_502_on_network_error(self):
        respx.post(f"{LITELLM_URL}/key/generate").mock(
            side_effect=httpx.ConnectError("connection refused")
        )
        with pytest.raises(HTTPException) as exc_info:
            await create_virtual_key(LITELLM_URL, MASTER_KEY, EMAIL)
        assert exc_info.value.status_code == 502

    @respx.mock
    async def test_raises_502_when_response_missing_key(self):
        respx.post(f"{LITELLM_URL}/key/generate").mock(
            return_value=httpx.Response(200, json={"token_id": "xyz"})
        )
        with pytest.raises(HTTPException) as exc_info:
            await create_virtual_key(LITELLM_URL, MASTER_KEY, EMAIL)
        assert exc_info.value.status_code == 502

    @respx.mock
    async def test_strips_trailing_slash_from_url(self):
        route = respx.post(f"{LITELLM_URL}/key/generate").mock(
            return_value=httpx.Response(200, json={"key": "sk-test"})
        )
        await create_virtual_key(LITELLM_URL + "/", MASTER_KEY, EMAIL)
        assert route.called

    @respx.mock
    async def test_returns_existing_key_when_alias_already_exists(self):
        respx.post(f"{LITELLM_URL}/key/generate").mock(
            return_value=httpx.Response(400, json={"error": {"message": "Key with alias 'alice@corp.com' already exists."}})
        )
        respx.get(f"{LITELLM_URL}/key/list").mock(
            return_value=httpx.Response(200, json={"keys": [{"key_alias": EMAIL, "key": "sk-existing-key"}]})
        )
        key = await create_virtual_key(LITELLM_URL, MASTER_KEY, EMAIL)
        assert key == "sk-existing-key"

    @respx.mock
    async def test_raises_502_when_existing_key_not_found_in_list(self):
        respx.post(f"{LITELLM_URL}/key/generate").mock(
            return_value=httpx.Response(400, json={"error": {"message": "Key with alias 'alice@corp.com' already exists."}})
        )
        respx.get(f"{LITELLM_URL}/key/list").mock(
            return_value=httpx.Response(200, json={"keys": []})
        )
        with pytest.raises(HTTPException) as exc_info:
            await create_virtual_key(LITELLM_URL, MASTER_KEY, EMAIL)
        assert exc_info.value.status_code == 502
