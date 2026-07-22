"""
BenchX configuration — environment variables and pricing constants.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# We need the OpenAI API key, but for dummy local tests without one,
# we default to "dummy-key" to prevent the app from crashing on start.
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or "dummy-key"
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or "dummy-key"
GROQ_API_KEY = os.getenv("GROQ_API_KEY") or "dummy-key"
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY") or "dummy-key"

# Groq exposes an OpenAI-compatible chat completions API, so we reuse the
# `openai` SDK for it instead of adding a dedicated dependency.
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"

# Models used for evaluators (independent of the experiment's own model).
EMBEDDING_MODEL = "text-embedding-3-small"
HALLUCINATION_JUDGE_MODEL = "gpt-4o-mini"

# ── Pricing Constants ────────────────────────────────────────────────
# Prices are per 1,000 tokens.
SUPPORTED_MODELS = {
    # --- OPENAI ---
    "gpt-4o": {
        "provider": "openai",
        "display_name": "GPT-4o",
        "input_price": 0.005,
        "output_price": 0.015,
        "context_window": 128000,
        "category": "frontier",
    },
    "gpt-4o-mini": {
        "provider": "openai",
        "display_name": "GPT-4o Mini",
        "input_price": 0.00015,
        "output_price": 0.0006,
        "context_window": 128000,
        "category": "efficient",
    },
    "gpt-4-turbo": {
        "provider": "openai",
        "display_name": "GPT-4 Turbo",
        "input_price": 0.01,
        "output_price": 0.03,
        "context_window": 128000,
        "category": "frontier",
    },
    "o1-mini": {
        "provider": "openai",
        "display_name": "o1 Mini",
        "input_price": 0.003,
        "output_price": 0.012,
        "context_window": 128000,
        "category": "reasoning",
    },
    "o3-mini": {
        "provider": "openai",
        "display_name": "o3 Mini",
        "input_price": 0.0011,
        "output_price": 0.0044,
        "context_window": 200000,
        "category": "reasoning",
    },

    # --- ANTHROPIC ---
    "claude-haiku-4-5-20251001": {
        "provider": "anthropic",
        "display_name": "Claude Haiku 4.5",
        "input_price": 0.00025,
        "output_price": 0.00125,
        "context_window": 200000,
        "category": "efficient",
    },
    "claude-sonnet-4-6": {
        "provider": "anthropic",
        "display_name": "Claude Sonnet 4.6",
        "input_price": 0.003,
        "output_price": 0.015,
        "context_window": 200000,
        "category": "frontier",
    },
    "claude-opus-4-6": {
        "provider": "anthropic",
        "display_name": "Claude Opus 4.6",
        "input_price": 0.015,
        "output_price": 0.075,
        "context_window": 200000,
        "category": "frontier",
    },

    # --- GROQ ---
    "llama-3.1-8b-instant": {
        "provider": "groq",
        "display_name": "Llama 3.1 8B (Groq)",
        "input_price": 0.000059,
        "output_price": 0.000079,
        "context_window": 131072,
        "category": "efficient",
    },
    "llama-3.1-70b-versatile": {
        "provider": "groq",
        "display_name": "Llama 3.1 70B (Groq)",
        "input_price": 0.00059,
        "output_price": 0.00079,
        "context_window": 131072,
        "category": "frontier",
    },
    "llama-3.3-70b-versatile": {
        "provider": "groq",
        "display_name": "Llama 3.3 70B (Groq)",
        "input_price": 0.00059,
        "output_price": 0.00079,
        "context_window": 131072,
        "category": "frontier",
    },
    "mixtral-8x7b-32768": {
        "provider": "groq",
        "display_name": "Mixtral 8x7B (Groq)",
        "input_price": 0.00024,
        "output_price": 0.00024,
        "context_window": 32768,
        "category": "efficient",
    },
    "gemma2-9b-it": {
        "provider": "groq",
        "display_name": "Gemma 2 9B (Groq)",
        "input_price": 0.00020,
        "output_price": 0.00020,
        "context_window": 8192,
        "category": "efficient",
    },

    # --- NVIDIA ---
    "meta/llama-3.1-8b-instruct": {
        "provider": "nvidia",
        "display_name": "Llama 3.1 8B (NVIDIA)",
        "input_price": 0.0001,
        "output_price": 0.0001,
        "context_window": 131072,
        "category": "efficient",
    },
    "meta/llama-3.1-70b-instruct": {
        "provider": "nvidia",
        "display_name": "Llama 3.1 70B (NVIDIA)",
        "input_price": 0.00035,
        "output_price": 0.00035,
        "context_window": 131072,
        "category": "frontier",
    },
    "meta/llama-3.1-405b-instruct": {
        "provider": "nvidia",
        "display_name": "Llama 3.1 405B (NVIDIA)",
        "input_price": 0.0035,
        "output_price": 0.0035,
        "context_window": 131072,
        "category": "frontier",
    },
    "mistralai/mistral-7b-instruct-v0.3": {
        "provider": "nvidia",
        "display_name": "Mistral 7B (NVIDIA)",
        "input_price": 0.0001,
        "output_price": 0.0001,
        "context_window": 32768,
        "category": "efficient",
    },
    "nvidia/nemotron-4-340b-instruct": {
        "provider": "nvidia",
        "display_name": "Nemotron 340B (NVIDIA)",
        "input_price": 0.0042,
        "output_price": 0.0042,
        "context_window": 4096,
        "category": "frontier",
    },
    "google/gemma-2-27b-it": {
        "provider": "nvidia",
        "display_name": "Gemma 2 27B (NVIDIA)",
        "input_price": 0.00020,
        "output_price": 0.00020,
        "context_window": 8192,
        "category": "efficient",
    },
}

PROVIDER_KEY_ENV = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "groq": "GROQ_API_KEY",
    "nvidia": "NVIDIA_API_KEY",
}


def get_provider_api_key(provider: str) -> str:
    """Return a configured provider credential or an actionable error."""
    key_name = PROVIDER_KEY_ENV.get(provider)
    if key_name is None:
        raise ValueError(f"Unsupported provider '{provider}'")
    api_key = os.getenv(key_name)
    if not api_key:
        raise ValueError(f"{key_name} not configured")
    return api_key


def list_models_by_provider() -> dict[str, list[dict]]:
    """Expose display-safe model metadata for the API and frontend selector."""
    grouped = {provider: [] for provider in PROVIDER_KEY_ENV}
    for key, model in SUPPORTED_MODELS.items():
        grouped[model["provider"]].append(
            {
                "key": key,
                **model,
                # Prices are already USD / 1K tokens, matching evaluate_cost.
                "cost_per_1k": round((model["input_price"] + model["output_price"]) / 2, 8),
            }
        )
    return grouped

# ── Statistical Significance ─────────────────────────────────────────
SIGNIFICANCE_THRESHOLD: float = 0.05

# Below this many paired observations, a pairwise metric test is flagged
# "underpowered" — not wrong, just too small a sample to trust on its own.
UNDERPOWERED_MIN_N: int = 8

# ── Concurrency ───────────────────────────────────────────────────────
MAX_CONCURRENT_REQUESTS: int = 5

# ── Server ────────────────────────────────────────────────────────────
BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")
BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
