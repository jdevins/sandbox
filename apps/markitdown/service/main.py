"""markitdown HTTP service.

A thin FastAPI wrapper around Microsoft's `markitdown`.

Run as standalone exe:  ./markitdown          (opens browser automatically)
Run as uvicorn service: python -m uvicorn main:app --port 8200
"""
import json
import os
import pathlib
import re
import sys
import tempfile
import threading

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response

try:
    from markitdown import MarkItDown
    _markitdown_import_error = None
except Exception as e:
    MarkItDown = None
    _markitdown_import_error = str(e)


# ── Paths ──────────────────────────────────────────────────────────────────────

def _bundle_dir() -> pathlib.Path:
    """Read-only data files: bundled in the exe or the service dir in dev."""
    if getattr(sys, 'frozen', False):
        return pathlib.Path(sys._MEIPASS)
    return pathlib.Path(__file__).parent


def _data_dir() -> pathlib.Path:
    """Writable runtime data (runs, etc.) — next to the exe when frozen."""
    if getattr(sys, 'frozen', False):
        return pathlib.Path(sys.executable).parent / 'data'
    return pathlib.Path(__file__).parent / 'data'


# ── Policy ────────────────────────────────────────────────────────────────────

_POLICY_PATH = _bundle_dir() / 'policy.json'
try:
    with open(_POLICY_PATH, encoding='utf-8') as _f:
        POLICY = json.load(_f)
    ACCEPTED = {e.lower() for e in POLICY.get('extensions', [])} or None
    MAX_FILE_BYTES = int(POLICY.get('maxFileMB', 50)) * 1_000_000
except Exception:
    POLICY, ACCEPTED, MAX_FILE_BYTES = {}, None, 50 * 1_000_000


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title='markitdown-service')
_md = MarkItDown() if MarkItDown else None

PLAINTEXT_FALLBACK = {'.csv'}


# ── Static assets ─────────────────────────────────────────────────────────────

@app.get('/static/css/dark.css')
def dark_css():
    path = _bundle_dir() / 'static' / 'css' / 'dark.css'
    return Response(path.read_text(encoding='utf-8'), media_type='text/css')


# ── UI ────────────────────────────────────────────────────────────────────────

def _render_ui() -> str:
    template = (_bundle_dir() / 'ui.html').read_text(encoding='utf-8')
    p = POLICY
    extensions = sorted(p.get('extensions', []))
    batch = p.get('oneOffBatch', {'maxFiles': 100, 'maxTotalMB': 250})
    savings = p.get('tokenSavings', {'charsPerToken': 4, 'defaultDensity': 0.2, 'density': {}})
    for k, v in {
        '{{TYPES_JSON}}':    json.dumps(extensions),
        '{{LIM_JSON}}':      json.dumps({
            'maxFiles':   batch.get('maxFiles', 100),
            'maxFileMB':  p.get('maxFileMB', 50),
            'maxTotalMB': batch.get('maxTotalMB', 250),
        }),
        '{{SAVINGS_JSON}}':  json.dumps(savings),
        '{{TYPES_HTML}}':    ''.join(f'<span>{t}</span>' for t in extensions),
        '{{TYPES_COUNT}}':   str(len(extensions)),
        '{{MAX_FILES}}':     str(batch.get('maxFiles', 100)),
        '{{MAX_FILE_MB}}':   str(p.get('maxFileMB', 50)),
        '{{MAX_TOTAL_MB}}':  str(batch.get('maxTotalMB', 250)),
    }.items():
        template = template.replace(k, v)
    return template


@app.get('/', response_class=HTMLResponse)
def ui():
    return _render_ui()


# ── Runs ──────────────────────────────────────────────────────────────────────

RUNS_DIR = _data_dir() / 'runs'
MAX_RUNS = 100


def _safe_id(run_id: str) -> str:
    return re.sub(r'[^\w\-]', '', run_id)[:80]


@app.get('/api/runs')
def list_runs():
    try:
        RUNS_DIR.mkdir(parents=True, exist_ok=True)
        runs = []
        for f in sorted(RUNS_DIR.glob('*.json')):
            try:
                r = json.loads(f.read_text(encoding='utf-8'))
                r.pop('items', None)
                runs.append(r)
            except Exception:
                pass
        runs.sort(key=lambda r: r.get('startedAt', ''), reverse=True)
        return runs
    except Exception:
        return []


@app.get('/api/runs/{run_id}')
def get_run(run_id: str):
    path = RUNS_DIR / f'{_safe_id(run_id)}.json'
    if not path.exists():
        raise HTTPException(status_code=404, detail='no such run')
    return json.loads(path.read_text(encoding='utf-8'))


@app.post('/api/runs')
async def save_run(request: Request):
    body = await request.json()
    run_id = body.get('id')
    if not run_id:
        raise HTTPException(status_code=400, detail='run record needs an id')
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    (RUNS_DIR / f'{_safe_id(run_id)}.json').write_text(json.dumps(body, indent=2), encoding='utf-8')
    _prune_runs()
    return {'ok': True, 'id': run_id}


def _prune_runs():
    files = sorted(RUNS_DIR.glob('*.json'))
    for f in files[:max(0, len(files) - MAX_RUNS)]:
        try:
            f.unlink()
        except Exception:
            pass


# ── Service API ───────────────────────────────────────────────────────────────

@app.get('/api/status')
def api_status():
    if _md is None:
        return {'ok': False, 'detail': f'markitdown not importable: {_markitdown_import_error}'}
    return {'ok': True, 'detail': 'markitdown ready'}


@app.post('/api/notify')
async def notify(request: Request):
    return {'ok': True, 'detail': 'notification stub'}


@app.get('/health')
def health():
    if _md is None:
        return JSONResponse(
            status_code=503,
            content={'ok': False, 'detail': f'markitdown not importable: {_markitdown_import_error}'},
        )
    return {'ok': True, 'detail': 'markitdown ready'}


@app.get('/policy')
def policy_route():
    return POLICY


@app.post('/shutdown')
def shutdown():
    threading.Timer(0.3, lambda: os._exit(0)).start()
    return {'ok': True, 'detail': 'shutting down'}


# ── Convert ───────────────────────────────────────────────────────────────────

@app.post('/convert')
async def convert(file: UploadFile = File(...)):
    if _md is None:
        raise HTTPException(status_code=503, detail=f'markitdown not importable: {_markitdown_import_error}')

    data = await file.read()
    ext = os.path.splitext(file.filename or '')[1].lower()
    suffix = ext or '.bin'

    if ACCEPTED is not None and ext not in ACCEPTED:
        raise HTTPException(status_code=415, detail=f'unsupported type: {ext or "(none)"}')
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f'file too large (limit {MAX_FILE_BYTES // 1_000_000}MB)')

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            markdown = _md.convert(tmp_path).text_content
        except Exception as conv_err:
            if suffix.lower() in PLAINTEXT_FALLBACK:
                markdown = data.decode('utf-8', errors='replace')
            else:
                raise HTTPException(status_code=422, detail=f'conversion failed: {conv_err}')
        return {'ok': True, 'filename': file.filename, 'markdown': markdown}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f'conversion failed: {e}')
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ── Standalone entry point ────────────────────────────────────────────────────

if __name__ == '__main__':
    import time
    import urllib.request
    import webbrowser
    import uvicorn

    port = int(os.environ.get('MARKITDOWN_PORT', 8200))
    url = f'http://127.0.0.1:{port}'

    threading.Thread(
        target=lambda: uvicorn.run(app, host='127.0.0.1', port=port, log_level='error'),
        daemon=True,
    ).start()

    # Wait for the server to accept connections before opening the browser.
    for _ in range(40):
        try:
            urllib.request.urlopen(f'{url}/health', timeout=0.5)
            break
        except Exception:
            time.sleep(0.25)

    webbrowser.open(url)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
