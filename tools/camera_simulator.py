"""Local USB control pad for the explicitly simulated Team 2 camera."""
import argparse
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import serial
from serial.tools import list_ports

parser = argparse.ArgumentParser()
parser.add_argument('--port', help='COM5 on Windows or /dev/cu.usbmodem... on macOS; auto-detects one ESP')
parser.add_argument('--http-port', type=int, default=8087)
args = parser.parse_args()
if not args.port:
    candidates=[p.device for p in list_ports.comports() if p.vid == 0x303A]
    if len(candidates)!=1:
        parser.error('Specify --port; expected exactly one connected ESP32 USB device. Found: '+', '.join(candidates))
    args.port=candidates[0]
device = serial.Serial()
device.port = args.port
device.baudrate = 115200
device.timeout = 0.5
device.write_timeout = 0.5
device.dtr = False
device.rts = False
device.open()
lock = threading.Lock()
state = {'connected': False, 'port': args.port, 'error': 'Waiting for ESP telemetry'}
last_seen = 0.0
fields = ['simulated', 'simulation_control', 'radar_x_mm', 'radar_y_mm',
          'radar_seq', 'radar_boot', 'wifi_connected', 'oocsi_connected', 'oocsi_enabled']

def reader():
    global last_seen
    while True:
        try:
            line = device.readline()
            try:
                data = json.loads(line)
            except (ValueError, UnicodeDecodeError):
                continue
            if data.get('type') != 'radar':
                continue
            with lock:
                state.update({key: data.get(key) for key in fields})
                state.update(connected=True, error='')
                last_seen = time.monotonic()
        except serial.SerialException:
            with lock:
                state.update(connected=False, error='USB disconnected. Reconnect and restart this control panel.')
            return

threading.Thread(target=reader, daemon=True).start()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *unused):
        pass

    def reply(self, code, data, content_type='application/json'):
        body = data if isinstance(data, bytes) else json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def valid_host(self):
        return self.headers.get('Host') in (f'localhost:{args.http_port}', f'127.0.0.1:{args.http_port}')

    def do_GET(self):
        if not self.valid_host():
            return self.reply(403, {'error': 'Local access only'})
        if self.path == '/':
            return self.reply(200, Path(__file__).with_name('camera_simulator.html').read_bytes(), 'text/html; charset=utf-8')
        if self.path == '/api/state':
            with lock:
                result = dict(state)
                result['connected'] = state['connected'] and time.monotonic()-last_seen < 2
            return self.reply(200, result)
        self.reply(404, {'error': 'Not found'})

    def do_POST(self):
        expected = {f'http://localhost:{args.http_port}', f'http://127.0.0.1:{args.http_port}'}
        if not self.valid_host() or self.headers.get('Origin') not in expected:
            return self.reply(403, {'error': 'Local control panel only'})
        if self.path != '/api/control':
            return self.reply(404, {'error': 'Not found'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 256:
                raise ValueError('Invalid request size')
            data = json.loads(self.rfile.read(length))
            cmd = data.get('command')
            if cmd == 'sim_move':
                if any(type(data.get(k)) is not int or abs(data[k]) > 500 for k in ('dx', 'dy')):
                    raise ValueError('Movement must be integer millimetres up to 500')
                out = {k: data[k] for k in ('command', 'dx', 'dy')}
            elif cmd == 'sim_reset':
                out = {'command': cmd}
            elif cmd == 'sim_control' and data.get('mode') in ('manual', 'guidance'):
                out = {'command': cmd, 'mode': data['mode']}
            else:
                raise ValueError('Unsupported command')
            with lock:
                if not state.get('simulated') or time.monotonic()-last_seen >= 2:
                    return self.reply(409, {'error': 'Connect a live SIMULATED ESP first'})
                device.write((json.dumps(out)+'\n').encode())
            self.reply(200, {'sent': True})
        except (ValueError, TypeError, AttributeError) as exc:
            self.reply(400, {'error': str(exc)})
        except serial.SerialException:
            self.reply(503, {'error': 'USB write failed'})

print(f'Camera simulator: http://localhost:{args.http_port} | {args.port}', flush=True)
try:
    ThreadingHTTPServer(('127.0.0.1', args.http_port), Handler).serve_forever()
finally:
    device.close()
