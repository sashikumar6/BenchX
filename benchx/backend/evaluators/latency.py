"""
Latency evaluator — measures response time in milliseconds.
"""


def evaluate_latency(elapsed_seconds: float) -> float:
    """
    Convert an elapsed time (in seconds, captured around the HTTP call)
    to milliseconds.

    Parameters
    ----------
    elapsed_seconds : float
        Wall-clock time for the agent call.

    Returns
    -------
    float
        Latency in milliseconds.
    """
    return round(elapsed_seconds * 1000, 2)
