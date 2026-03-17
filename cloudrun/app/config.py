from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    litellm_master_key: str
    litellm_url: str = "https://litellm.athena.tools"
    api_key: str

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
