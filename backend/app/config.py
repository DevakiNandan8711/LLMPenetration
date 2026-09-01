from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM: openai-compatible (Groq, OpenAI, Together, etc.) or ollama
    llm_provider: str = "openai"  # openai | ollama
    # Groq uses the same Bearer + /v1/chat/completions; set GROQ_API_KEY or OPENAI_API_KEY
    groq_api_key: str = ""
    openai_api_key: str = ""
    openai_base_url: str = "https://api.groq.com/openai/v1"
    openai_model: str = "openai/gpt-oss-120b"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.2"

    # When true, prefer canned demo steps in auto mode; set false when using Groq/API
    demo_mode: bool = False

    # Docker executor
    sandbox_image: str = "hacksynth-sandbox:latest"
    use_mock_executor: bool = False
    command_timeout_sec: int = 120
    max_output_chars: int = 24_000

    # Agent loop
    default_max_steps: int = 8


@lru_cache
def get_settings() -> Settings:
    return Settings()
