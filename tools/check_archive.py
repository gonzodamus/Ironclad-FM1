#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Read-only archive hygiene check; no firmware build or device access."""
import hashlib
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN = {'.fwsc', '.ufw', '.bin', '.hex', '.elf', '.o', '.a', '.so', '.dylib', '.dll', '.exe', '.wasm', '.ll', '.bc', '.f32', '.zip', '.tgz', '.deb'}
STOCK_SHA = 'db1642b2b6fa5c2cccb11ffd13878068bb28601678d3644049f99dc40e7edb8a'
errors = []
for p in ROOT.rglob('*'):
    if not p.is_file() or '.git' in p.relative_to(ROOT).parts:
        continue
    rel = p.relative_to(ROOT)
    if p.suffix in FORBIDDEN or p.name.endswith(('.tar.gz', '.tar.xz')):
        errors.append(f'compiled/archive artifact: {rel}')
    if any(v in rel.parts for v in ['.openai', '.wrangler', '.vercel', '.netlify', 'node_modules', '__pycache__', 'build']):
        errors.append(f'generated/hosting state: {rel}')
    data = p.read_bytes()
    if hashlib.sha256(data).hexdigest() == STOCK_SHA:
        errors.append(f'stock firmware image: {rel}')
    if 'sessions' not in rel.parts and (b'prime-' + b'bell-8785') in data:
        errors.append(f'former live installer address: {rel}')
# Include every reachable commit; fail on forbidden path suffixes, stock blobs and nested Gitlinks.
if (ROOT / '.git').exists():
    raw = subprocess.check_output(['git', 'rev-list', '--objects', '--all'], cwd=ROOT, text=True)
    for line in raw.splitlines():
        parts = line.split(' ', 1)
        if len(parts) != 2:
            continue
        oid, name = parts
        if Path(name).suffix in FORBIDDEN or name.endswith(('.tar.gz', '.tar.xz')):
            errors.append(f'artifact in Git history: {name}')
        kind = subprocess.check_output(['git', 'cat-file', '-t', oid], cwd=ROOT, text=True).strip()
        if kind == 'blob':
            blob = subprocess.check_output(['git', 'cat-file', 'blob', oid], cwd=ROOT)
            if hashlib.sha256(blob).hexdigest() == STOCK_SHA:
                errors.append(f'stock image in Git history: {name}')
if errors:
    print('\n'.join(errors))
    sys.exit(1)
print('Archive hygiene passed: no flash images, compiled/release archives, hosting state or stock image in the tree or reachable Git history.')
