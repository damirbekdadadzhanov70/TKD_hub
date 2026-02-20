import logging
import os
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.exc import IntegrityError

from api.routes import admin, audit, coach, me, notifications, ratings, tournaments, training, users, weight_entries

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
)

# ── Rate limiter ──────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(title="TKD Hub API", version="1.0.0")
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.warning("IntegrityError on %s %s: %s", request.method, request.url.path, exc.orig)
    return JSONResponse(
        status_code=409,
        content={"detail": "Conflict: resource already exists or constraint violated"},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ── CORS ──────────────────────────────────────────────────────
_env = os.getenv("ENVIRONMENT", "development")
_cors_extra = os.getenv("CORS_ORIGINS", "")

allowed_origins: list[str] = [
    "https://web.telegram.org",
    "https://tkd-hub.vercel.app",
]
_origin_regex: str | None = None

if _cors_extra:
    allowed_origins.extend(o.strip() for o in _cors_extra.split(",") if o.strip())
if _env != "production":
    allowed_origins.extend(
        [
            "http://localhost:5173",
            "http://localhost:5174",
            "https://localhost:5173",
            "https://localhost:5174",
        ]
    )
    _origin_regex = r"https://tkd-hub[a-z0-9-]*\.vercel\.app|https://.*\.(ngrok-free\.app|ngrok\.io)"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# ── Request logging middleware ────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    logger.info(
        "%s %s → %d (%.0fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# ── Routes ────────────────────────────────────────────────────
app.include_router(me.router, prefix="/api", tags=["me"])
app.include_router(tournaments.router, prefix="/api", tags=["tournaments"])
app.include_router(training.router, prefix="/api", tags=["training"])
app.include_router(ratings.router, prefix="/api", tags=["ratings"])
app.include_router(coach.router, prefix="/api", tags=["coach"])
app.include_router(audit.router, prefix="/api", tags=["audit"])
app.include_router(admin.router, prefix="/api", tags=["admin"])
app.include_router(notifications.router, prefix="/api", tags=["notifications"])
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(weight_entries.router, prefix="/api", tags=["weight-entries"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── Serve webapp static files (SPA) ─────────────────────────
_webapp_dist = Path(__file__).resolve().parent.parent / "webapp" / "dist"

if _webapp_dist.is_dir():
    app.mount("/assets", StaticFiles(directory=_webapp_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA for all non-API routes."""
        file_path = _webapp_dist / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_webapp_dist / "index.html")
