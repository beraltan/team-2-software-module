# Optional USB tools (uv)

The main module is the static browser app. These tools retain the former local USB workflow for bench diagnostics, calibration recording and fallback experiments.

Install uv and Node 22+, then from this repository:

```sh
uv sync --locked
uv run --locked python app/server.py --port COM4
```

Replace COM4 with your serial device. Windows `start.cmd --port COM4` runs the same uv command. uv manages `.venv`; never copy a virtual environment between computers.

Open `http://127.0.0.1:8765`. This serves `usb.html` / `usb-app.js`, not the new static controller. `/radar` shows diagnostics; `/facilitator` handles calibration/setup using the local key in `logs/toktik_facilitator_key.txt`.

The legacy service and Things companion retain the Team 2 channel. They are diagnostic tools, not the recommended reusable module. Never enable their OOCSI publishing alongside the browser controller on the same channel. Close the service before browser USB setup; only one application can own a serial port.

Tests: `uv run --locked python -m unittest discover -s app -p test_engine.py`.
Hardware scripts `verify_local.py` and `verify_setup.py` require a service and camera. `measure_delay.py` analyses manually annotated video frames; it does not generate measurements.
