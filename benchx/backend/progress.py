"""In-process fan-out for live run progress events.

The runner has no knowledge of browser connections.  It publishes durable-ish
per-run events here, and each connected WebSocket receives its own queue.  The
database remains the source of truth, so a reconnect can always hydrate from
``GET /runs/{id}`` if it misses an event.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any
from uuid import UUID


class RunProgressHub:
    def __init__(self) -> None:
        self._subscribers: dict[UUID, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe(self, run_id: UUID) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=32)
        async with self._lock:
            self._subscribers[run_id].add(queue)
        return queue

    async def unsubscribe(self, run_id: UUID, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            subscribers = self._subscribers.get(run_id)
            if subscribers is None:
                return
            subscribers.discard(queue)
            if not subscribers:
                self._subscribers.pop(run_id, None)

    async def send_json(self, event: dict[str, Any]) -> None:
        """Publish an event without letting a slow browser block a run."""
        run_id = UUID(str(event["run_id"]))
        async with self._lock:
            subscribers = list(self._subscribers.get(run_id, set()))
        for queue in subscribers:
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            queue.put_nowait(event)


run_progress_hub = RunProgressHub()
