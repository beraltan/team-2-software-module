"""Compatibility adapter. All gameplay rules run in engine.mjs via Node.js."""
import atexit
import json
import math
from pathlib import Path
import shutil
import subprocess
import threading
import uuid
_process = None
_lock = threading.Lock()

def _clean(value):
    if isinstance(value, float) and not math.isfinite(value): return None
    if isinstance(value, dict): return {k: _clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [_clean(v) for v in value]
    return value

def _close():
    if _process and _process.poll() is None:
        _process.terminate()
        _process.wait(timeout=3)
atexit.register(_close)

def _request(identifier, method, args):
    global _process
    with _lock:
        if _process is None:
            node = shutil.which('node')
            if not node: raise RuntimeError('Node.js is required for the JavaScript game engine.')
            _process = subprocess.Popen([node, str(Path(__file__).with_name('engine_host.mjs'))],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding='utf-8',
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if _process.poll() is not None:
            raise RuntimeError('JavaScript engine stopped. Restart service; the attempt is invalid.')
        _process.stdin.write(json.dumps(_clean(dict(id=identifier, method=method, args=args)), allow_nan=False)+'\n')
        _process.stdin.flush()
        line = _process.stdout.readline()
        if not line: raise RuntimeError('JavaScript engine disconnected.')
        return json.loads(line)

class Game:
    def __init__(self, now, config=None):
        object.__setattr__(self, '_id', uuid.uuid4().hex)
        object.__setattr__(self, '_state', {})
        self._call('create', now, config or {})
    def _call(self, method, *args):
        reply = _request(self._id, method, args)
        if reply.get('state') is not None: object.__setattr__(self, '_state', reply['state'])
        if 'error' in reply: raise ValueError(reply['error'])
        return reply.get('value')
    def __getattr__(self, name):
        if name in self._state: return self._state[name]
        if name in ('ingest', 'fresh', 'zone', 'start', 'finish', 'reset', 'tick', 'tripwire', 'snapshot', 'guide', 'signal', 'rules', 'field'):
            return lambda *args: self._call(name, *args)
        raise AttributeError(name)
    def __setattr__(self, name, value): self._call('set', name, value)
