import os
from dataclasses import dataclass
from dotenv import load_dotenv
 
load_dotenv()
 
@dataclass
class Settings:
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    openai_max_tokens: int = int(os.getenv("OPENAI_MAX_TOKENS", "4096"))
    openai_temperature: float = float(os.getenv("OPENAI_TEMPERATURE", "0.2"))
 
 
settings = Settings()
 