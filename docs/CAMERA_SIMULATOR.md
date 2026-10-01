# USB camera simulator

This optional local control panel sends movement commands over USB to an ESP running the **simulation firmware**. The ESP publishes positions through OOCSI, so the game uses the same camera-discovery path as real radar. It does not fabricate sensor measurements in production firmware.

The real firmware and simulation-build instructions are in the [hardware repository](https://github.com/beraltan/team-2-hardware-module/tree/main/firmware/Concept1_Camera). Ordinary Arduino IDE uploads use real sensor mode; this control panel requires `TEAM2_SIMULATION=1`.

## macOS

With Python 3 installed, run from this repository's folder:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install pyserial==3.5
.venv/bin/python tools/camera_simulator.py
```

One connected native-USB ESP32 is detected automatically. If several are attached, specify its port:

```sh
.venv/bin/python -m serial.tools.list_ports
.venv/bin/python tools/camera_simulator.py --port /dev/cu.usbmodemYOUR_PORT
```

Open **http://localhost:8087**. Use the buttons or arrow keys, choose a 5/10/25 cm step, or press START to restore the simulated starting position. A movement command switches to serial control; the mode button can hand control back to the game's guidance. The panel only accepts movement when fresh telemetry identifies a simulated ESP. Close Arduino Serial Monitor first. Stop the local server with Ctrl+C to release the port before flashing.

On Windows, use `.venv\Scripts\python.exe tools\camera_simulator.py --port COM5`; replace the port if necessary. The included `start-camera-simulator.cmd` uses COM5.

Keep only one Bank Heist controller connected to your team channel. For desktop testing, place the game and controls in separate visible windows: the game deliberately faults a running round when its tab becomes hidden. No changes to the hosted game are required for USB position controls.

Verified on Windows with a physical ESP: a button changed X from -1100 to -1000 mm and the Data Foundry game received the change through OOCSI. macOS serial support is provided by pyserial; this launcher has not been tested on a Mac.
