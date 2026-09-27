# Team 2 — Software module: Bank Heist / Toktik

A two-player connected experience: the navigator sees radar position, a randomly generated security grid, timer and anomalies, while the infiltrator navigates the physical space. JavaScript owns game rules; Python provides USB, HTTP and optional OOCSI transport.

**Hardware module:** https://github.com/beraltan/team-2-hardware-module

## Install and run

Requires Python 3.10+ and Node.js 22+. From this folder:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.\start.cmd --port COM4
```

Replace COM4 with your board's serial port. On macOS/Linux, use .venv/bin/python app/server.py --port /dev/your-device. Close other serial monitors first. Open http://127.0.0.1:8765; facilitator setup is /facilitator. The locally generated key is in logs/toktik_facilitator_key.txt. Do not publish that file.

## Game and field setup

- Defaults: 180 seconds, 5-second penalty, 3 anomalies to lockdown. The route stays fixed during each round.
- Proposed rectangle: 3 m wide × 2 m deep, X −1.5…1.5 m and Y 1.5…3.5 m in front of the radar. Change width, depth and near edge while idle in facilitator setup. A 3 × 3 grid adapts to these bounds.
- Both map axes use the same millimetre scale. The radar reports a moving-body estimate, not foot position; this is not camera perspective projection. Mount level, walk known points, verify left/right (mirror option) and measure position error before confirming setup.
- Hold guidance buttons to send cues. For a player facing the camera: left is +X, right −X, forward −Y, back +Y. Commands expire without renewal; tracking/connection faults override guidance.
- OOCSI is off by default. Only enable it for an agreed session. Public server users can see transmitted positions and game state. Wi-Fi setup alone does not authorize continuous public sharing.

## Tests

```powershell
npm test
.venv\Scripts\python.exe -m unittest discover -s app -p test_engine.py
```

Nine JavaScript tests and fifteen legacy Python adapter regressions pass at packaging time. Hardware latency, position error, LED comprehension and room coverage still require physical testing. app/measure_delay.py analyses manually annotated video frames; see --help.

## Structure

- app/: browser pages, JavaScript engine, Python service and tests.
- tools/radar_dashboard/: raw radar diagnostic view served at /radar.
- docs/INTERFACE.md: hardware/software message contract.
- logs/: generated local runtime data (gitignored).

## Known limits

The firmware's target-selection envelope remains X ±1500 / Y 1500–4500 mm, so a second person outside a smaller configured rectangle can still cause an ambiguous reading. The legacy calibration recorder offers fixed reference points; use points inside your chosen field. The new LED firmware is compiled but still needs flashing and optical validation. The map/start OOCSI Things companion is optional; full guidance is on the local dashboard.

Toktik is adapted from the course material by Mathias Funk / TU/e. Original attribution is preserved in app/vendor/toktik-original.html. See THIRD_PARTY.md. Team 2: Anouk Kramer, Alp Altaner, Berk Eraltan Sönmezgil, Sebastiaan Schenk.
