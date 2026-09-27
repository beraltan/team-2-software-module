"""Read-only live integration checks plus rejected unauthorized actions. No public connection."""
import json
from pathlib import Path
import time
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
URL='http://127.0.0.1:8765'


def read():
    with urllib.request.urlopen(URL+'/api/state',timeout=3) as r:return json.load(r)


def rejected(action,expected,origin=None):
    headers={'Content-Type':'application/json'}
    if origin:headers['Origin']=origin
    request=urllib.request.Request(URL+'/api/action',json.dumps({'action':action}).encode(),headers=headers)
    try:
        with urllib.request.urlopen(request,timeout=3) as r:status=r.status
    except urllib.error.HTTPError as exc:status=exc.code
    assert status==expected,(action,status,expected)


if __name__=='__main__':
    initial=read();sequences={};deadline=time.monotonic()+3
    while time.monotonic()<deadline:
        d=read()
        for line in d['lines']:
            try:r=json.loads(line)
            except ValueError:continue
            if r.get('type')=='radar':sequences[(r['radar_boot'],r['radar_seq'])]=r
        time.sleep(.1)
    final=read()
    assert final['connected'] and final['fresh'],'No live camera USB data'
    assert not final['network']['enabled'] and final['network']['sent']==0,'OOCSI unexpectedly enabled'
    assert not final['wifi_enabled'],'Camera Wi-Fi unexpectedly enabled'
    assert final['heartbeat_age_ms'] is not None and final['heartbeat_age_ms']<1500,'Camera not receiving idle heartbeat'
    rejected('reset',403);rejected('abort',403);rejected('network',403)
    rejected('start',403,'https://unrelated.invalid')
    # No start request is submitted: a real round is a facilitator/player action.
    values=sorted(sequences.values(),key=lambda r:r['radar_device_ms'])
    intervals=[b['radar_device_ms']-a['radar_device_ms'] for a,b in zip(values,values[1:]) if a['radar_boot']==b['radar_boot']]
    typical=sorted(intervals)[len(intervals)//2]
    assert 190<=typical<=210,intervals
    report=dict(passed=True,usb_connected=True,firmware_json_messages=len(values),median_publish_interval_ms=typical,
                heartbeat_age_ms=final['heartbeat_age_ms'],firmware_led=final['led'],game_state=final['game']['state'],
                unauthorized_reset_abort_network='403 rejected',cross_origin_start='403 rejected',
                public_oocsi_enabled=False,camera_wifi_enabled=False,
                caveat='Physical LED unwired; direct Wi-Fi and floor/paired trials not tested. No positions retained by this verification.')
    (ROOT/'logs/concept1_local_verification.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
