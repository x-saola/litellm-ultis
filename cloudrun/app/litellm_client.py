import httpx
from fastapi import HTTPException, status


async def key_exists(litellm_url: str, master_key: str, key: str) -> bool:
    """Return True if the key still exists in LiteLLM."""
    base_url = litellm_url.rstrip("/")
    headers = {"Authorization": f"Bearer {master_key}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(f"{base_url}/key/info", headers=headers, params={"key": key})
            return resp.status_code == 200
        except httpx.RequestError:
            return True  # Network error — assume key is valid to avoid unnecessary recreation


async def get_teams(litellm_url: str, master_key: str) -> list[dict]:
    """Fetch all teams from LiteLLM."""
    base_url = litellm_url.rstrip("/")
    headers = {"Authorization": f"Bearer {master_key}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(f"{base_url}/team/list", headers=headers)
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to reach LiteLLM: {e}",
            )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LiteLLM /team/list returned {resp.status_code}: {resp.text}",
            )
    data = resp.json()
    if isinstance(data, list):
        return data
    return data.get("teams", [])


def find_team_for_domain(teams: list[dict], email: str) -> str | None:
    """Return the team_id whose team_alias matches the email domain, or None."""
    domain = email.split("@")[-1].lower()
    for team in teams:
        alias = (team.get("team_alias") or "").lower()
        if alias == domain:
            return team.get("team_id")
    return None


async def _get_token_by_alias(
    client: httpx.AsyncClient, base_url: str, headers: dict, email: str
) -> str:
    """Return the token hash for the key aliased to email."""
    resp = await client.get(
        f"{base_url}/key/list",
        headers=headers,
        params={"key_alias": email},
    )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to list keys: {resp.text}",
        )

    for k in resp.json().get("keys", []):
        if isinstance(k, str):
            return k
        if isinstance(k, dict) and k.get("key_alias") == email:
            token = k.get("token") or k.get("key_id") or k.get("id")
            if token:
                return token

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Could not find existing key for alias '{email}'",
    )


async def create_virtual_key(
    litellm_url: str,
    master_key: str,
    email: str,
    team_id: str,
    budget_usd: float = 200.0,
) -> str:
    """Create or regenerate the LiteLLM virtual key for the given email/team.

    First call  → POST /key/generate
    Repeat call → look up token by alias, then POST /key/{token}/regenerate
                  (returns a fresh sk-... without needing the original key)
    """
    base_url = litellm_url.rstrip("/")
    headers = {
        "Authorization": f"Bearer {master_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "key_alias": email,
        "team_id": team_id,
        "max_budget": budget_usd,
        "budget_duration": "monthly",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(f"{base_url}/key/generate", json=payload, headers=headers)
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to reach LiteLLM: {e}",
            )

        if response.status_code == 400 and "already exists" in response.text:
            token = await _get_token_by_alias(client, base_url, headers, email)
            try:
                response = await client.post(
                    f"{base_url}/key/{token}/regenerate",
                    json=payload,
                    headers=headers,
                )
            except httpx.RequestError as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to reach LiteLLM: {e}",
                )

        if not response.is_success:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LiteLLM returned error {response.status_code}: {response.text}",
            )

    virtual_key = response.json().get("key")
    if not virtual_key:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LiteLLM response did not contain a key",
        )
    return virtual_key
