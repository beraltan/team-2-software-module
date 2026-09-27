# Validation · browser-first rebuild

Checked locally on 2026-09-27; no push or deployment performed.

## Automated

- `npm.cmd test`: 27 tests pass (rules/geometry, browser controller/transport, course adapter and bundled-file checks).
- `uv run --locked python -m unittest discover -s app -p test_engine.py`: 15 adapter regression tests pass.
- `uv sync --locked`: creates the project `.venv` using the pinned dependency lock.

The new tests cover independent camera discovery/selection, connection/start gates, competing controllers, a quiet period before publishing, firmware-compatible heartbeat fields, source changes, boot restarts, stale samples, channel validation, and WebSocket framing/filtering with a fake socket. They do **not** establish live OOCSI delivery or firmware behaviour.

## Browser check

Opened the real static app in desktop Chrome through localhost. Verified the offline demo, setup checkbox/start gate, running round, refresh → fault, reset → idle, and retained channel. Inspected the rendered dashboard. The demo opens no OOCSI connection.

## Still requires the kit / external environment

- Live OOCSI end-to-end delivery, camera discovery, actual firmware LED response, and Wi-Fi setup through Web Serial.
- Competing physical/browser controllers on the public server; automated collision tests are not a distributed-system guarantee.
- Touch interaction and layout on actual phones, screen sleep/background lifecycle and network changes.
- Physical position error, room coverage, latency, and comprehension of directional LED pulses.
- Static HTTPS deployment and host MIME types. Local preview succeeded; the repo is not published.

The original firmware accepts heartbeats from different sessions; it does not enforce ownership itself. Use one controller and a unique channel. The browser's visibility/suspension detection cannot guarantee delivery of a final STOP after a crash; firmware heartbeat expiry is the fallback. The page cannot turn camera publishing off merely by disconnecting.

Team-owned code is MIT licensed (see LICENSE); upstream terms remain separate. THIRD_PARTY.md preserves the course material attribution. No real measurements or completed hardware checks are claimed.

## Course single-file revision

The primary handover is now `bank-heist.html`. It embeds the existing course libraries, application code and styles. Its standard team dialog was checked in Chrome, including empty-team rejection. A local test fixture using the real bundled Things library and a fake WebSocket verified Team 2 ? OOCSI-things/team-2, camera discovery/selection, setup and a running round without contacting the public server. `node tools/course-smoke.mjs` regenerates that ignored fixture in `test-output/`; never distribute the fixture as the real module. Actual Data Foundry upload and physical OOCSI delivery remain untested.

## Maze revision

Replaced the monotonic safe-cell path with spanning-tree mazes and room-sized start/goal regions. Automated checks cover 540 seeded layouts across three fields and three difficulty settings, full connectivity, required detours, geometric clearances, layout variety, boundary wall closure, fast crossings, and simulated walks to the vault without penalties. The single-file demo was inspected in Chrome with a 4 x 3 Hard maze. Physical passage accuracy remains unverified.

## Bank Heist deployment (2026-09-27)

Renamed the standalone file to bank-heist.html and the app to Bank Heist; OOCSI toktik_* fields remain compatible. Team-owned code is MIT licensed, with upstream terms preserved. All 27 JavaScript tests passed after the rename. Uploaded to Data Foundry project 13764, dataset 27070; Web Access enabled and bank-heist.html selected as entry point. Verified the public URL loads the renamed page and the hosted offline demo starts a Hard maze and resets to idle. Live hardware/OOCSI remains unverified. This records validation before the GitHub release.

[Play Bank Heist](https://data.id.tue.nl/web/djI6N01hckdUYks4bUZJeXE1RlhPY1hUQWxfRFl4bWd4NXpSRklGbmVvVUZ5U3dYTGxwbmVwWUdYQURTTG5iRGl3/)
