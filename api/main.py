from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import coach, me, ratings, tournaments, training

app = FastAPI(title="TKD Hub API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://localhost:5173",
        "https://web.telegram.org",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(me.router, prefix="/api", tags=["me"])
app.include_router(tournaments.router, prefix="/api", tags=["tournaments"])
app.include_router(training.router, prefix="/api", tags=["training"])
app.include_router(ratings.router, prefix="/api", tags=["ratings"])
app.include_router(coach.router, prefix="/api", tags=["coach"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
