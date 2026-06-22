# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the standalone MarkItDown exe.
#
# Build:  npm run markitdown:build
#         (or: python -m PyInstaller markitdown.spec --noconfirm)
#
# Output: dist/markitdown/markitdown.exe  + supporting files
# Ship:   zip the entire dist/markitdown/ folder and share it.
#
# Toggle console=True/False below:
#   True  — a terminal window shows server log (useful while testing)
#   False — silent background process, cleaner for end users

import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

SHOW_CONSOLE = True

hidden_imports = (
    collect_submodules('uvicorn') +
    collect_submodules('fastapi') +
    collect_submodules('starlette') +
    collect_submodules('markitdown') +
    ['multipart', 'python_multipart']
)

# Resolve paths relative to this spec file so the build works from any cwd.
_here = SPECPATH
_root = os.path.normpath(os.path.join(_here, '..', '..', '..'))

datas = [
    (os.path.join(_here, 'ui.html'),                                    '.'),
    (os.path.join(_here, '..', 'policy.json'),                          '.'),
    (os.path.join(_root, 'public', 'css', 'dark.css'), os.path.join('static', 'css')),
]
datas += collect_data_files('markitdown')

a = Analysis(
    [os.path.join(_here, 'main.py')],
    pathex=[_here],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='markitdown',
    debug=False,
    strip=False,
    upx=True,
    console=SHOW_CONSOLE,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='markitdown',
)
