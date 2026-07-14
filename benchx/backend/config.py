"""
BenchX configuration — environment variables and pricing constants.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# We need the OpenAI API key, but for dummy local tests without one,
# we default to "dummy-key" to prevent the app from crashing on start.
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "dummy-key")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "dummy-key")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "dummy-key")

# Groq exposes an OpenAI-compatible chat completions API, so we reuse the
# `openai` SDK for it instead of adding a dedicated dependency.
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# Models used for evaluators (independent of the experiment's own model).
EMBEDDING_MODEL = "text-embedding-3-small"
HALLUCINATION_JUDGE_MODEL = "gpt-4o-mini"

# ── Pricing Constants ────────────────────────────────────────────────
# Prices are per 1,000 tokens
SUPPORTED_MODELS = {
    "gpt-4o-mini": {
        "provider": "openai",
        "input_price": 0.00015,
        "output_price": 0.0006,
    },
    "gpt-4o": {
        "provider": "openai", 
        "input_price": 0.005,
        "output_price": 0.015,
    },
    "claude-haiku-4-5-20251001": {
        "provider": "anthropic",
        "input_price": 0.00025,
        "output_price": 0.00125,
    },
    "claude-sonnet-4-6": {
        "provider": "anthropic",
        "input_price": 0.003,
        "output_price": 0.015,
    },
    "llama-3.1-8b-instant": {
        "provider": "groq",
        "input_price": 0.000059,
        "output_price": 0.000079,
    }
}

# ── Statistical Significance ─────────────────────────────────────────
SIGNIFICANCE_THRESHOLD: float = 0.05

# ── Concurrency ───────────────────────────────────────────────────────
MAX_CONCURRENT_REQUESTS: int = 5

# ── Server ────────────────────────────────────────────────────────────
BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
