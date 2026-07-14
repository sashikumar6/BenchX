"""
Cost evaluator — estimates USD cost from token usage using per-model
pricing from config.SUPPORTED_MODELS.
"""

from ..config import SUPPORTED_MODELS


def evaluate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """
    Calculate the cost in USD for a single LLM call.

    Parameters
    ----------
    model : str
        The model name, looked up in config.SUPPORTED_MODELS.
    prompt_tokens : int
        Number of input (prompt) tokens.
    completion_tokens : int
        Number of output (completion) tokens.

    Returns
    -------
    float
        Estimated cost in USD, rounded to 6 decimal places.
    """
    pricing = SUPPORTED_MODELS.get(model)
    if pricing is None:
        return 0.0

    cost = (prompt_tokens / 1000) * pricing["input_price"] + (
        completion_tokens / 1000
    ) * pricing["output_price"]
    return round(cost, 6)
