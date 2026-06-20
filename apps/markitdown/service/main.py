"""markitdown HTTP service.

A thin FastAPI wrapper around Microsoft's `markitdown`. The Node sandbox app
proxies file uploads here; this process only converts bytes to markdown. It has
no filesystem access of its own — directory crawling and write-back are done in
the browser (File System Access API), so this service stays stateless and can
live anywhere (local or remote) unchanged.

Run directly:  python -m uvicorn main:app --port 8200
Usually started for you by the Node app's `spawn` launcher.
"""
import json
import os
import tempfile
import threading

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

try:
    from markitdown import MarkItDown
    _markitdown_import_error = None
except Exception as e:  # markitdown not installed / broken extras
    MarkItDown = None
    _markitdown_import_error = str(e)

app = FastAPI(title="markitdown-service")
_md = MarkItDown() if MarkItDown else None

# If markitdown's converter chokes on one of these (almost always a text-encoding
# issue, not a real failure), we fall back to decoding the bytes as UTF-8 so the
# file still produces usable markdown instead of erroring out.
PLAINTEXT_FALLBACK = {".csv"}

# Acceptance policy — single source of truth shared with the Node app/UI. Enforced
# here so every consumer (UI, future API) obeys the same rules. If the file can't
# be read, fall back to accepting any type (ACCEPTED=None) rather than rejecting all.
_POLICY_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "policy.json")
try:
    with open(_POLICY_PATH, encoding="utf-8") as _f:
        POLICY = json.load(_f)
    ACCEPTED = {e.lower() for e in POLICY.get("extensions", [])} or None
    MAX_FILE_BYTES = int(POLICY.get("maxFileMB", 50)) * 1_000_000
except Exception:
    POLICY, ACCEPTED, MAX_FILE_BYTES = {}, None, 50 * 1_000_000


@app.get("/health")
def health():
    if _md is None:
        return JSONResponse(
            status_code=503,
            content={"ok": False, "detail": f"markitdown not importable: {_markitdown_import_error}"},
        )
    return {"ok": True, "detail": "markitdown ready"}


@app.get("/policy")
def policy():
    """The acceptance policy, so any client can stay in sync with the server."""
    return POLICY


@app.post("/shutdown")
def shutdown():
    """Exit the process so the Node launcher can respawn a fresh one. Bound to
    127.0.0.1, so only the local app can call it. Used by the 'restart service'
    control to pick up new code/policy/env."""
    threading.Timer(0.3, lambda: os._exit(0)).start()
    return {"ok": True, "detail": "shutting down"}


@app.post("/convert")
async def convert(file: UploadFile = File(...)):
    """Convert one uploaded file to markdown. Used by both Files and Directory modes."""
    if _md is None:
        raise HTTPException(status_code=503, detail=f"markitdown not importable: {_markitdown_import_error}")

    data = await file.read()
    ext = os.path.splitext(file.filename or "")[1].lower()
    suffix = ext or ".bin"

    # Single acceptance policy, enforced for every caller.
    if ACCEPTED is not None and ext not in ACCEPTED:
        raise HTTPException(status_code=415, detail=f"unsupported type: {ext or '(none)'}")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"file too large (limit {MAX_FILE_BYTES // 1_000_000}MB)")

    # markitdown infers type best from a real path/extension, so spool to a temp file.
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            markdown = _md.convert(tmp_path).text_content
        except Exception as conv_err:
            if suffix.lower() in PLAINTEXT_FALLBACK:
                markdown = data.decode("utf-8", errors="replace")
            else:
                raise HTTPException(status_code=422, detail=f"conversion failed: {conv_err}")
        return {"ok": True, "filename": file.filename, "markdown": markdown}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"conversion failed: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
