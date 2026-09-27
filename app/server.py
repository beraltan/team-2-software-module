"""Toktik game service and USB/OOCSI adapters. Local-only by default."""
import argparse
from collections import deque
import csv
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import math
from pathlib import Path
import queue
import secrets
import socket
import sys
import threading
import time
from urllib.parse import urlparse
import uuid

ROOT = Path(__file__).resolve().parents[1]
HERE = Path(__file__).resolve().parent
import serial
from engine import Game

LOCK = threading.RLock()
GAME = Game(time.monotonic())
COMMANDS = queue.Queue(maxsize=20)
RAW = deque(maxlen=12)
SETUP_INFO = None
RADAR = dict(connected=False, error='Connecting to USB', targets=[], frame=0, device_ms=0,
             fresh=False, rate=None, age_ms=None, lines=[], led='off', wifi_enabled=False, oocsi_connected=False)
LAST_RX = None
LAST_DATA = None
LAST_SEQ = None
SESSION = uuid.uuid4().hex
FACILITATOR_FILE = ROOT / 'logs/toktik_facilitator_key.txt'
FACILITATOR_FILE.parent.mkdir(exist_ok=True)
if FACILITATOR_FILE.exists():
    ADMIN_KEY = FACILITATOR_FILE.read_text().strip()
else:
    ADMIN_KEY = secrets.token_urlsafe(24)
    FACILITATOR_FILE.write_text(ADMIN_KEY)
CHANNEL = 'OOCSI-things/team-2-bank-heist'
NETWORK = dict(enabled=False, connected=False, error='', channel=CHANNEL, host='oocsi.id.tue.nl', received=0, sent=0)
CLIENT = None
NET_QUEUE = queue.Queue(maxsize=20)
REMOTE_ACTIONS = queue.Queue(maxsize=20)
REMOTE_SEEN = deque(maxlen=200)
CALIBRATION = None
CALIBRATION_ROWS = []
CALIBRATION_SUMMARY = None
CALIBRATION_PENDING = queue.Queue(maxsize=30)
RUNTIME_FILE = ROOT / 'logs/toktik_attempt.json'


def save_attempt():
    temporary = RUNTIME_FILE.with_suffix('.tmp')
    temporary.write_text(json.dumps(dict(state=GAME.state, remaining_s=GAME.remaining, round_id=GAME.round_id)))
    temporary.replace(RUNTIME_FILE)


def enqueue(command):
    try:
        COMMANDS.put_nowait(command)
    except queue.Full:
        raise ValueError('USB command queue is full; check the camera connection.')


def ingest(data, now, source):
    global LAST_RX, LAST_DATA, LAST_SEQ
    if not isinstance(data, dict) or 'radar_seq' not in data:
        return
    with LOCK:
        if GAME.ingest(data, now):
            previous = LAST_DATA
            LAST_RX, LAST_DATA = now, data
            targets = data.get('targets')
            if targets is None:
                targets = [dict(id=1, x=data['radar_x_mm'], y=data['radar_y_mm'], speed=0)] if data.get('radar_valid') else []
            RADAR.update(targets=targets, frame=data.get('radar_frame', 0), device_ms=data.get('radar_device_ms', 0),
                         led=data.get('led', RADAR['led']), wifi_enabled=data.get('wifi_enabled', False),
                         oocsi_connected=data.get('oocsi_connected', False), error='', source=source)
            RADAR['heartbeat_age_ms']=data.get('heartbeat_age_ms')
            RADAR['guidance_supported']=data.get('guidance_supported') is True
            if previous and data.get('radar_boot') == previous.get('radar_boot'):
                dt = data.get('radar_device_ms', 0) - previous.get('radar_device_ms', 0)
                if dt > 0:
                    RADAR['rate'] = round((data.get('radar_frame', 0)-previous.get('radar_frame', 0))*1000/dt, 1)
            if source == 'usb' and NETWORK['enabled']:
                payload = {k:v for k,v in data.items() if k.startswith('radar_') or k == 'guidance_supported'}
                network_send(payload)
            if CALIBRATION is not None:
                point = GAME.point
                row = dict(sample=len(CALIBRATION_ROWS)+1, elapsed_s=now-CALIBRATION['started'],
                           x_ref_mm=CALIBRATION['x'], y_ref_mm=CALIBRATION['y'],
                           x_mm=point['x'] if point else '', y_mm=point['y'] if point else '',
                           valid=bool(point), cover=CALIBRATION['cover'], motion=CALIBRATION['motion'],
                           error_mm=math.hypot(point['x']-CALIBRATION['x'],point['y']-CALIBRATION['y']) if point else '')
                CALIBRATION_ROWS.append(row)


def serial_loop(port):
    global SETUP_INFO
    while True:
        try:
            with serial.Serial(port,115200,timeout=.05,write_timeout=.25) as device:
                with LOCK: RADAR.update(connected=True,error='Waiting for Concept 1 firmware')
                while True:
                    line=device.readline().decode('utf-8',errors='replace').strip()
                    if line:
                        if line.startswith('{'):
                            try:
                                parsed = json.loads(line)
                                if parsed.get('type') == 'setup':
                                    with LOCK: SETUP_INFO = parsed
                                else:
                                    with LOCK: RAW.append(line)
                                    ingest(parsed,time.monotonic(),'usb')
                            except (ValueError,KeyError,TypeError): pass
                    try: command=COMMANDS.get_nowait()
                    except queue.Empty: continue
                    device.write((json.dumps(command)+'\n').encode())
        except (OSError,serial.SerialException) as exc:
            with LOCK: RADAR.update(connected=False,error=str(exc))
            time.sleep(1)


def network_send(payload):
    if NETWORK['enabled']:
        try: NET_QUEUE.put_nowait(payload)
        except queue.Full: pass  # never stall the game; old data is not retried


def receive(sender, channel, event):
    if not NETWORK['enabled'] or sender.startswith('team2_toktik_service_'):
        return
    with LOCK: NETWORK['received']+=1
    if 'radar_seq' in event and sender.startswith('team2_camera_'):
        ingest(event,time.monotonic(),'oocsi')
    # The remote navigator may start only, never reset, abort, or clear a fault.
    action=event.get('navigator_start')
    if isinstance(action,str) and 1<=len(action)<=100 and action not in REMOTE_SEEN:
        REMOTE_SEEN.append(action)
        try: REMOTE_ACTIONS.put_nowait('start')
        except queue.Full: pass


def stop_client(client):
    if client:
        client.reconnect=False; client.connected=False
        try: client.sock.shutdown(socket.SHUT_RDWR)
        except OSError: pass
        client.sock.close()
        client.runtime.join(timeout=1)


def network_loop():
    global CLIENT
    from oocsi import OOCSI
    while True:
        if not NETWORK['enabled']:
            stop_client(CLIENT);CLIENT=None
            with LOCK: NETWORK['connected']=False
            while not NET_QUEUE.empty():
                try: NET_QUEUE.get_nowait()
                except queue.Empty: break
            time.sleep(.1);continue
        try:
            if CLIENT is None or not CLIENT.connected:
                stop_client(CLIENT)
                CLIENT=OOCSI('team2_toktik_service_'+SESSION[:8],NETWORK['host'],logger=lambda _:None,maxReconnectionAttempts=0)
                CLIENT.subscribe(NETWORK['channel'],receive)
                # Discard any queued samples/heartbeats from the outage.
                while not NET_QUEUE.empty():
                    try: NET_QUEUE.get_nowait()
                    except queue.Empty: break
            with LOCK: NETWORK.update(connected=CLIENT.connected,error='')
            try: payload=NET_QUEUE.get(timeout=.1)
            except queue.Empty: continue
            if NETWORK['enabled']:
                CLIENT.send(NETWORK['channel'],payload)
                with LOCK: NETWORK['sent']+=1
        except Exception as exc:
            with LOCK: NETWORK.update(connected=False,error=str(exc))
            stop_client(CLIENT);CLIENT=None;time.sleep(1)


def loop():
    last_heartbeat=0; last_state=GAME.state; last_log=0
    if RUNTIME_FILE.exists():
        try:
            if json.loads(RUNTIME_FILE.read_text()).get('state')=='running':
                GAME.finish('fault','Toktik service restarted; facilitator reset required',time.monotonic())
        except (ValueError,OSError): GAME.finish('fault','Uncertain previous attempt; check setup',time.monotonic())
    while True:
        now=time.monotonic()
        with LOCK:
            GAME.tick(now)
            try:
                REMOTE_ACTIONS.get_nowait()
                try: GAME.start(now)
                except ValueError: pass
            except queue.Empty: pass
            if GAME.state!=last_state:
                save_attempt();last_state=GAME.state
            if now-last_heartbeat>=.2:
                GAME.last_beat+=1
                beat=dict(toktik_state=GAME.state,toktik_time_s=round(GAME.remaining,2),toktik_suspicion=round(GAME.suspicion,3),
                          toktik_beat=GAME.last_beat,toktik_session=SESSION,
                          toktik_zone_x_mm=sum(GAME.zone(now)[:2])/2,toktik_penalties=GAME.penalties,
                          toktik_ready=GAME.setup_checked,toktik_guide=GAME.signal(now),
                          toktik_play=GAME.cfg['play'],toktik_start=GAME.cfg['start'],toktik_goal=GAME.cfg['goal'],toktik_mirror_x=GAME.cfg['mirror_x'],toktik_zones=GAME.snapshot(now)['zones'],toktik_max_anomalies=GAME.cfg['max_anomalies'],
                          toktik_tick=int(GAME.elapsed_s),toktik_toggle=GAME.state=='running')
                try: enqueue(dict(command='heartbeat',**beat))
                except ValueError: pass
                network_send(beat);last_heartbeat=now
            if len(GAME.events)>last_log:
                with (ROOT/'logs/toktik_events.jsonl').open('a',encoding='utf-8') as f:
                    for event in GAME.events[last_log:]: f.write(json.dumps(event)+'\n')
                last_log=len(GAME.events)
            if CALIBRATION and now-CALIBRATION['started']>=CALIBRATION['duration']:
                finish_calibration()
        time.sleep(.02)


def percentile(values,p):
    if not values:return None
    values=sorted(values);i=(len(values)-1)*p;lo=int(i);hi=min(lo+1,len(values)-1)
    return values[lo]+(values[hi]-values[lo])*(i-lo)


def finish_calibration():
    global CALIBRATION,CALIBRATION_SUMMARY
    if CALIBRATION is None:return
    errors=[r['error_mm'] for r in CALIBRATION_ROWS if r['valid']]
    expected=max(1,round((time.monotonic()-CALIBRATION['started'])*5))
    CALIBRATION_SUMMARY=dict(samples=len(CALIBRATION_ROWS),valid_samples=len(errors),expected_samples=expected,
                             valid_sample_percent=100*len(errors)/max(expected,len(CALIBRATION_ROWS)),
                             median_error_mm=percentile(errors,.5),p95_error_mm=percentile(errors,.95),
                             x_ref_mm=CALIBRATION['x'],y_ref_mm=CALIBRATION['y'],cover=CALIBRATION['cover'],motion=CALIBRATION['motion'])
    folder=ROOT/'logs/calibration';folder.mkdir(exist_ok=True)
    name=time.strftime('%Y%m%d_%H%M%S')+'_'+uuid.uuid4().hex[:4]
    if CALIBRATION_ROWS:
        with (folder/(name+'.csv')).open('w',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=list(CALIBRATION_ROWS[0]));writer.writeheader();writer.writerows(CALIBRATION_ROWS)
    (folder/(name+'.json')).write_text(json.dumps(CALIBRATION_SUMMARY,indent=2))
    CALIBRATION=None


class Handler(BaseHTTPRequestHandler):
    def respond(self,data,status=200,mime='application/json'):
        body=data if isinstance(data,bytes) else json.dumps(data).encode()
        self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(body)

    def do_GET(self):
        path=urlparse(self.path).path
        if path=='/api/camera-setup':
            if not secrets.compare_digest(self.headers.get('Authorization',''),'Bearer '+ADMIN_KEY):
                self.respond({'error':'Facilitator key required'},403);return
            with LOCK: self.respond(SETUP_INFO or {'pending':True})
            return
        if path=='/api/state':
            with LOCK:
                data=dict(RADAR);age=time.monotonic()-LAST_RX if LAST_RX is not None else None
                data.update(age_ms=round(age*1000) if age is not None else None,fresh=age is not None and age<.45,
                            lines=list(RAW),port=ARGS.port,game=GAME.snapshot(time.monotonic()),network=dict(NETWORK),
                            calibration=CALIBRATION,calibration_summary=CALIBRATION_SUMMARY)
                if not data['fresh']:data['targets']=[]
            self.respond(data);return
        paths={'/':HERE/'usb.html','/app.js':HERE/'usb-app.js','/spatial.mjs':HERE/'spatial.mjs','/style.css':HERE/'style.css','/facilitator':HERE/'facilitator.html',
               '/radar':ROOT/'tools/radar_dashboard/index.html','/things':HERE/'things.html',
               '/vendor/oocsi-web.js':HERE/'vendor/oocsi-web.js','/vendor/oocsi-things.min.js':HERE/'vendor/oocsi-things.min.js'}
        file=paths.get(path)
        if not file or not file.exists():self.respond({'error':'Not found'},404);return
        mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[file.suffix]
        self.respond(file.read_bytes(),mime=mime)

    def do_POST(self):
        global CALIBRATION,CALIBRATION_ROWS
        origin=self.headers.get('Origin')
        if origin and urlparse(origin).netloc!=self.headers.get('Host'):
            self.respond({'error':'Origin rejected'},403);return
        try:
            size=int(self.headers.get('Content-Length',0))
            if not 0<size<=4096:raise ValueError('Invalid request size')
            d=json.loads(self.rfile.read(size));action=d.get('action')
            if self.path!='/api/action':self.respond({'error':'Not found'},404);return
            if action not in ('start','guide') and not secrets.compare_digest(self.headers.get('Authorization',''),'Bearer '+ADMIN_KEY):
                self.respond({'error':'Facilitator key required'},403);return
            with LOCK:
                now=time.monotonic()
                if action=='start':GAME.start(now);save_attempt()
                elif action=='guide':GAME.guide(d.get('direction'),now)
                elif action=='field':GAME.field(d.get('width_mm'),d.get('depth_mm'),d.get('near_mm'),d.get('mirror_x',False))
                elif action=='rules':GAME.rules(d.get('max_anomalies'),d.get('penalty_s'))
                elif action=='ready':
                    if GAME.state!='idle':raise ValueError('Reset the attempt first')
                    GAME.setup_checked=bool(d.get('checked'))
                elif action=='abort':
                    if GAME.state=='running':GAME.finish('fault','Facilitator aborted the attempt',now);save_attempt()
                elif action=='reset':GAME.reset(now);save_attempt()
                elif action=='network':
                    if GAME.state=='running':raise ValueError('Abort the round before changing connectivity')
                    NETWORK['enabled']=d.get('enabled') is True
                elif action=='wifi_config':
                    if GAME.state=='running':raise ValueError('Abort before configuring the camera')
                    ssid,password=d.get('ssid',''),d.get('password','')
                    if not isinstance(ssid,str) or not 1<=len(ssid.encode())<=32 or not isinstance(password,str) or len(password.encode())>64:raise ValueError('Invalid Wi-Fi credentials')
                    enqueue(dict(command='wifi_config',ssid=ssid,password=password,channel=CHANNEL,enabled=d.get('enabled') is True))
                elif action=='wifi_disable':enqueue(dict(command='wifi_disable'))
                elif action=='setup_info':enqueue(dict(command='setup_info'))
                elif action=='calibrate':
                    if GAME.state=='running':raise ValueError('Calibration is separate from gameplay')
                    if CALIBRATION:raise ValueError('A trial is already recording')
                    x,y=float(d['x']),float(d['y']);duration=float(d.get('duration',10))
                    if x not in (-1000,0,1000) or y not in (2000,3000,4000) or not 5<=duration<=120:raise ValueError('Select a marked grid point and a duration of 5–120 seconds')
                    CALIBRATION_ROWS=[];CALIBRATION=dict(x=x,y=y,duration=duration,started=now,cover=bool(d.get('cover')),motion=str(d.get('motion','moving'))[:30])
                elif action=='calibration_stop':finish_calibration()
                else:raise ValueError('Unknown action')
            self.respond({'ok':True})
        except (ValueError,KeyError,TypeError) as exc:self.respond({'error':str(exc)},400)

    def log_message(self,*args):pass


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',default='COM4');parser.add_argument('--http-port',type=int,default=8765)
    ARGS=parser.parse_args();socket.setdefaulttimeout(3)
    server=ThreadingHTTPServer(('127.0.0.1',ARGS.http_port),Handler)
    for target,args in [(serial_loop,(ARGS.port,)),(network_loop,()),(loop,())]:threading.Thread(target=target,args=args,daemon=True).start()
    print(f'Toktik: http://127.0.0.1:{ARGS.http_port} | OOCSI off | facilitator key in {FACILITATOR_FILE}',flush=True)
    try:server.serve_forever()
    finally:NETWORK['enabled']=False;stop_client(CLIENT);server.server_close()
