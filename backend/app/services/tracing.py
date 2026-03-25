from __future__ import annotations

from contextlib import contextmanager

from app.config import LANGFUSE_HOST, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY

try:
    from langfuse import Langfuse
except Exception:  # pragma: no cover
    Langfuse = None


class TracingService:
    def __init__(self):
        self.client = None
        if Langfuse and LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY:
            self.client = Langfuse(
                public_key=LANGFUSE_PUBLIC_KEY,
                secret_key=LANGFUSE_SECRET_KEY,
                host=LANGFUSE_HOST,
            )

    @contextmanager
    def span(self, name: str, input_data=None, metadata=None):
        if not self.client:
            yield None
            return

        span = self.client.start_as_current_span(
            name=name,
            input=input_data,
            metadata=metadata or {},
        )
        try:
            yield span
        finally:
            span.end()


tracing_service = TracingService()
