"""Unit tests for auth module."""
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.auth import verify_google_token, extract_email, is_domain_whitelisted


class TestVerifyGoogleToken:
    def test_returns_claims_on_valid_token(self):
        fake_claims = {"email": "user@example.com", "sub": "12345"}
        with patch("app.auth.id_token.verify_firebase_token", return_value=fake_claims):
            result = verify_google_token("valid.token.here")
        assert result == fake_claims

    def test_falls_back_to_verify_token_when_firebase_fails(self):
        fake_claims = {"email": "user@example.com", "sub": "12345"}
        with (
            patch("app.auth.id_token.verify_firebase_token", side_effect=Exception("not firebase")),
            patch("app.auth.id_token.verify_token", return_value=fake_claims),
        ):
            result = verify_google_token("valid.token.here")
        assert result == fake_claims

    def test_raises_401_when_both_verifications_fail(self):
        with (
            patch("app.auth.id_token.verify_firebase_token", side_effect=Exception("fail")),
            patch("app.auth.id_token.verify_token", side_effect=Exception("fail")),
        ):
            with pytest.raises(HTTPException) as exc_info:
                verify_google_token("bad.token")
        assert exc_info.value.status_code == 401


class TestExtractEmail:
    def test_returns_email_from_claims(self):
        claims = {"email": "alice@domain.com", "sub": "abc"}
        assert extract_email(claims) == "alice@domain.com"

    def test_raises_401_when_email_missing(self):
        with pytest.raises(HTTPException) as exc_info:
            extract_email({"sub": "abc"})
        assert exc_info.value.status_code == 401


class TestIsDomainWhitelisted:
    def test_allows_whitelisted_domain(self):
        assert is_domain_whitelisted("user@allowed.com", ["allowed.com"]) is True

    def test_rejects_non_whitelisted_domain(self):
        assert is_domain_whitelisted("user@other.com", ["allowed.com"]) is False

    def test_case_insensitive_comparison(self):
        assert is_domain_whitelisted("user@ALLOWED.COM", ["allowed.com"]) is True

    def test_empty_whitelist_returns_false(self):
        assert is_domain_whitelisted("user@allowed.com", []) is False

    def test_multiple_domains_in_whitelist(self):
        domains = ["corp.com", "partner.org"]
        assert is_domain_whitelisted("user@corp.com", domains) is True
        assert is_domain_whitelisted("user@partner.org", domains) is True
        assert is_domain_whitelisted("user@outsider.io", domains) is False
