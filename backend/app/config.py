"""Application settings, read from environment variables (see .env.example)."""
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Root .env (shared with Docker) first, then backend/.env for local overrides.
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str = "postgresql+asyncpg://astra:astra@localhost:5432/astra"
    data_mode: str = Field("offline", pattern="^(live|offline)$")
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    cors_origin_regex: str | None = None   # e.g. https://astra-shield-.*\.onrender\.com in production
    log_level: str = "info"
    ephemeris_path: str = ""
    ticker_enabled: bool = True   # background snapshot task (disabled in tests)

    # Risk fusion weights (design choices, not clinically validated)
    risk_w_radiation: float = 0.60
    risk_w_sleep: float = 0.40
    green_below: int = 40
    red_at_or_above: int = 70

    # SAA polygon (lat, lon) vertices and intensity peak; approximate footprint at ~400 km.
    saa_polygon: list[tuple[float, float]] = [
        (0.0, -90.0), (0.0, 40.0), (-50.0, 40.0), (-50.0, -90.0),
    ]
    saa_peak: tuple[float, float] = (-25.0, -50.0)
    # A predicted "pass" must reach this peak intensity; filters edge clips of the wide polygon.
    saa_pass_min_peak: float = 0.2

    # Cache TTLs (seconds)
    tle_ttl_s: int = 6 * 3600
    flare_ttl_s: int = 5 * 60

    @field_validator("database_url")
    @classmethod
    def _async_driver(cls, v: str) -> str:
        """Hosted Postgres (Render, Railway, Heroku) hands out postgres:// URLs; use the asyncpg driver."""
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+asyncpg://" + v[len(prefix):]
        return v

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
