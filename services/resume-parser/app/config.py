from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "karta-resume-parser"
    log_level: str = "INFO"
    max_upload_bytes: int = 15 * 1024 * 1024
    spacy_model: str = "en_core_web_trf"
    spacy_fallback_model: str = "en_core_web_sm"
    sentence_transformer_model: str = "all-MiniLM-L6-v2"
    enable_docling: bool = True
    presidio_language: str = "en"


settings = Settings()
