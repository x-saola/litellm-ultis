from fastapi import FastAPI, Header, HTTPException, Request, status, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware

from app.auth import verify_google_token, extract_email
from app.config import Settings, get_settings
from app.litellm_client import create_virtual_key, get_teams, find_team_for_domain


app = FastAPI(title="LiteLLM Access Gateway")

_SKIP_API_KEY_PATHS = {"/health"}


class APIKeyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings_factory=get_settings):
        super().__init__(app)
        self._settings_factory = settings_factory

    async def dispatch(self, request: Request, call_next):
        if request.url.path in _SKIP_API_KEY_PATHS:
            return await call_next(request)

        settings: Settings = self._settings_factory()
        api_key = request.headers.get("X-API-Key", "")
        if api_key != settings.api_key:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid or missing API key"},
            )
        return await call_next(request)


app.add_middleware(APIKeyMiddleware)


class KeyResponse(BaseModel):
    key: str
    email: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/key", response_model=KeyResponse)
async def generate_key(
    authorization: str = Header(..., description="Bearer <google-identity-token>"),
    settings: Settings = Depends(get_settings),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be 'Bearer <token>'",
        )
    token = authorization.removeprefix("Bearer ")

    claims = verify_google_token(token)
    email = extract_email(claims)

    teams = await get_teams(
        litellm_url=settings.litellm_url,
        master_key=settings.litellm_master_key,
    )
    team_id = find_team_for_domain(teams, email)
    if team_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email domain does not match any authorized team",
        )

    virtual_key = await create_virtual_key(
        litellm_url=settings.litellm_url,
        master_key=settings.litellm_master_key,
        email=email,
        team_id=team_id,
    )

    return KeyResponse(key=virtual_key, email=email)
