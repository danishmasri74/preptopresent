"""HTTP surface of the worker: health checks for the hosting platform.

Jobs are not triggered over HTTP; they are picked up from the Postgres queue by app.runner.
"""

from fastapi import FastAPI

from app.config import get_settings
from app.jobs import registered_kinds

app = FastAPI(title="PrepToPresent worker", version="0.1.0")


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "environment": get_settings().environment,
        "job_kinds": registered_kinds(),
    }
