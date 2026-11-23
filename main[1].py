from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse


app = FastAPI(title="Chatbot", version="1.0.0")
ROOT = Path(__file__).resolve().parent


def page(filename: str) -> FileResponse:
    return FileResponse(
        ROOT / filename,
        media_type="text/html; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/", include_in_schema=False)
async def home() -> FileResponse:
    return page("index.html")


@app.get("/index.html", include_in_schema=False)
async def index_page() -> FileResponse:
    return page("index.html")


@app.get("/admin.html", include_in_schema=False)
async def admin_page() -> FileResponse:
    return page("admin.html")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "Chatbot"}
