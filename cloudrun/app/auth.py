from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from fastapi import HTTPException, status


def verify_google_token(token: str) -> dict:
    """Verify a Google Identity token and return its claims."""
    try:
        request = google_requests.Request()
        claims = id_token.verify_firebase_token(token, request)
        return claims
    except Exception:
        # Fall back to generic token verification (works for Google Identity tokens from Cloud Run)
        try:
            claims = id_token.verify_token(
                token,
                google_requests.Request(),
                audience=None,
            )
            return claims
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Google Identity token: {e}",
            )


def extract_email(claims: dict) -> str:
    """Extract email from token claims."""
    email = claims.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not contain an email claim",
        )
    return email


def is_domain_whitelisted(email: str, whitelist_domains: list[str]) -> bool:
    """Check if the email domain is in the whitelist."""
    if not whitelist_domains:
        return False
    domain = email.split("@")[-1].lower()
    return domain in [d.lower() for d in whitelist_domains]
