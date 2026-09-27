"""Local setup credential routing check. Does not connect to Wi-Fi or OOCSI."""
import json
from pathlib import Path
import time
from urllib.request import Request,urlopen
from urllib.error import HTTPError
root=Path(__file__).resolve().parents[1]
base='http://127.0.0.1:8765'
key=(root/'logs/toktik_facilitator_key.txt').read_text().strip()
headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'}
try:
    urlopen(base+'/api/camera-setup')
    raise AssertionError('Unauthenticated setup data exposed')
except HTTPError as exc: assert exc.code==403
with urlopen(Request(base+'/api/action',json.dumps({'action':'setup_info'}).encode(),headers)) as r: assert r.status==200
for _ in range(20):
    with urlopen(Request(base+'/api/camera-setup',headers=headers)) as r: data=json.load(r)
    if not data.get('pending'): break
    time.sleep(.2)
assert data['ssid'].startswith('Team2-Camera-') and len(data['password'])>=12
with urlopen(base+'/api/state') as r: public=r.read().decode()
assert data['password'] not in public and '"type": "setup"' not in public
assert not json.loads(public)['network']['enabled']
print('PASS: authenticated setup response, password absent from public state/history, OOCSI off')
