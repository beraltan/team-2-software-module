# Development and repository map

[Back to README](../README.md)

## Build and preview

Use Node 22+ from the repository root. No npm dependencies need installing.

```sh
npm run build
npm test
npm start
```

On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`. Preview at http://localhost:8080, or http://localhost:8080/bank-heist.html?demo=1 for offline mode.

Edit `app/`, then regenerate **bank-heist.html**. Include the generated file when publishing source changes. `npm test` also rebuilds and checks rules, geometry, controller/transport behaviour, maze generation and bundle syntax.

## Python: uv and .venv

Python is optional for the browser module. The earlier USB service and regression checks use:

```sh
uv sync --locked
uv run --locked python -m unittest discover -s app -p test_engine.py
```

uv creates the project `.venv`; `uv run` needs no manual activation. `pyproject.toml`, `uv.lock` and `.python-version` define the environment. `requirements.txt` is a compatibility export. See [USB diagnostics](USB.md).

## Repository map

| Path | Purpose |
| --- | --- |
| `bank-heist.html` | Generated standalone handover |
| `index.html` | Redirect to the handover |
| `app/engine.mjs` | Game state and rules |
| `app/maze.mjs` | Maze generation and wall crossings |
| `app/spatial.mjs` | Field geometry |
| `app/controller.mjs` | Camera selection, controller checks and heartbeats |
| `app/things-connection.mjs` | Course Things adapter |
| `app/browser.mjs` | UI actions, lifecycle and USB provisioning |
| `app/app.js`, `app/style.css` | Rendering and styling |
| `app/index.html`, `app/connection.mjs` | Developer dashboard and raw OOCSI transport |
| `app/vendor/` | Upstream course libraries |
| `app/server.py`, `app/usb.html`, `app/usb-app.js` | Earlier Python/USB diagnostic path |
| `app/things.html` | Earlier companion; not the main handover |
| `tools/build-thing.mjs` | Single-file bundler |
| `tools/preview.mjs` | Local server |
| `tools/course-smoke.mjs` | Ignored browser fixture with simulated networking |
| `docs/` | Setup, operation, integration and validation |

## Before handover

Run automated checks after code changes. Test the regenerated file's offline setup/start/reset flow, then live discovery, guidance, fault recovery and room coverage with the kit. Record actual results in [VALIDATION.md](VALIDATION.md); simulated delivery is not a hardware test.

Upload only `bank-heist.html` for Data Foundry play. Keep `.venv`, `.toolchain`, `logs`, `node_modules` and `test-output` out of the handover. Never distribute the smoke-test fixture as the actual module. Preserve [attribution](../THIRD_PARTY.md).
