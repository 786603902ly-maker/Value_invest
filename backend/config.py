from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    fmp_api_key: str = ""
    fmp_base_url: str = "https://financialmodelingprep.com/api/v3"
    cache_ttl_seconds: int = 3600  # 1 hour default

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
