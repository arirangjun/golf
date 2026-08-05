from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    database_url: str | None = Field(default=None, validation_alias="DATABASE_URL")
    mysql_url: str | None = Field(default=None, validation_alias="MYSQL_URL")
    mysqlhost: str | None = Field(default=None, validation_alias="MYSQLHOST")
    mysqlport: str | None = Field(default="3306", validation_alias="MYSQLPORT")
    mysqluser: str | None = Field(default=None, validation_alias="MYSQLUSER")
    mysqlpassword: str | None = Field(default=None, validation_alias="MYSQLPASSWORD")
    mysqldatabase: str | None = Field(default=None, validation_alias="MYSQLDATABASE")

    jwt_secret: str = Field(default="dev-secret-change-me", validation_alias="JWT_SECRET")
    environment: str = Field(default="production", validation_alias="ENVIRONMENT")
    frontend_url: str = Field(
        default="https://localhost:3000",
        validation_alias="FRONTEND_URL",
    )
    cookie_name: str = "golf_session"
    cookie_max_age: int = 60 * 60 * 24 * 7

    def _build_mysql_url(self) -> str:
        if self.database_url:
            return self.database_url
        if self.mysql_url:
            return self.mysql_url
        if self.mysqlhost and self.mysqluser and self.mysqlpassword and self.mysqldatabase:
            port = self.mysqlport or "3306"
            return (
                f"mysql://{self.mysqluser}:{self.mysqlpassword}"
                f"@{self.mysqlhost}:{port}/{self.mysqldatabase}"
            )
        raise ValueError(
            "DATABASE_URL 또는 Railway MySQL 변수(MYSQLHOST 등)가 필요합니다."
        )

    @property
    def sqlalchemy_url(self) -> str:
        url = self._build_mysql_url()
        if url.startswith("mysql://"):
            return url.replace("mysql://", "mysql+pymysql://", 1)
        if url.startswith("mysql+pymysql://"):
            return url
        return url

    @property
    def is_production(self) -> bool:
        return self.environment != "development"

    @property
    def cors_origins(self) -> list[str]:
        origins = {self.frontend_url.rstrip("/")}
        if not self.is_production:
            origins.add("http://localhost:3000")
            origins.add("http://127.0.0.1:3000")
        return sorted(origins)


settings = Settings()
