from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    database_url: str = Field(
        default="mysql+pymysql://user:password@localhost:3306/golf",
        validation_alias="DATABASE_URL",
    )
    jwt_secret: str = Field(default="dev-secret-change-me", validation_alias="JWT_SECRET")
    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    frontend_url: str = Field(default="http://localhost:3000", validation_alias="FRONTEND_URL")
    cookie_name: str = "golf_session"
    cookie_max_age: int = 60 * 60 * 24 * 7

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url
        if url.startswith("mysql://"):
            return url.replace("mysql://", "mysql+pymysql://", 1)
        return url

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
