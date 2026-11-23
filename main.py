from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse


app = FastAPI(title="Chatbot", version="1.1.0")
ROOT = Path(__file__).resolve().parent

HTML = "text/html; charset=utf-8"
JS = "text/javascript; charset=utf-8"
MANIFEST = "application/manifest+json; charset=utf-8"
PNG = "image/png"

# Yalnız bu fayllar açıq verilir (main.py, schema.sql və s. kənardan oxuna bilməz).
STATIC_FILES: dict[str, tuple[str, str]] = {
    "index.html": (HTML, "no-store"),
    "admin.html": (HTML, "no-store"),
    "supabase-config.js": (JS, "no-cache"),
    "sw.js": (JS, "no-cache"),
    "manifest.json": (MANIFEST, "no-cache"),
    "icon-192.png": (PNG, "public, max-age=86400"),
    "icon-512.png": (PNG, "public, max-age=86400"),
}


def serve(filename: str) -> FileResponse:
    entry = STATIC_FILES.get(filename)
    path = ROOT / filename
    if entry is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    media_type, cache_control = entry
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": cache_control, "X-Content-Type-Options": "nosniff"},
    )


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "Chatbot"}


@app.get("/", include_in_schema=False)
async def home() -> FileResponse:
    return serve("index.html")


@app.get("/admin", include_in_schema=False)
async def admin_alias() -> FileResponse:
    return serve("admin.html")


@app.get("/{filename}", include_in_schema=False)
async def static_file(filename: str) -> FileResponse:
    return serve(filename)
