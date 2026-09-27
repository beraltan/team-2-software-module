# Troubleshooting

[Back to README](../README.md)

| Symptom | What to check |
| --- | --- |
| Data Foundry shows a file list or wrong page | Enable Web Access and select `bank-heist.html` as Web Access Entry Point. Open the generated web URL. |
| The page looks like GitHub | Download the raw HTML file and upload that, rather than a saved GitHub page. |
| Old version appears | Check the uploaded file and entry point, then hard-refresh outside a round. |
| OOCSI cannot connect | Check internet and access to `wss://oocsi.id.tue.nl/ws`. Try offline demo to separate hosting from live connectivity. |
| Camera missing | Check firmware, 2.4 GHz Wi-Fi, enabled publishing and the exact team channel. USB save success does not prove Wi-Fi connected. |
| Old Team 2 camera missing | Standard Team 2 uses `OOCSI-things/team-2`, not the old `OOCSI-things/team-2-bank-heist`. Reconfigure the camera. |
| USB port unavailable | Use desktop Chrome/Edge on HTTPS or localhost, a data-capable cable and no other open serial monitor. |
| Cannot start | Select a camera, ensure fresh valid tracking, confirm setup, stand at START and allow the initial three-second controller check. |
| Competing controller | Close extra controllers, wait three quiet seconds and reset. Give other groups their own team channels. |
| Fault after tab switch or screen lock | Keep the controller visible and awake. Inspect and reset; interrupted rounds do not resume. |
| Tracking jumps or faults | Use one target in verified sensor coverage, check placement and known floor marks, and inspect camera diagnostics. |
| Left/right reversed | Walk known marks and check Mirror X before starting. Reconfirm setup after applying changes. |
| Excessive wall penalties | Try Normal or enlarge the field within verified coverage. Walk-test position noise; passage geometry does not guarantee radar accuracy. |
| LEDs do not follow cues | Check compatible firmware, `guidance_supported`, channel, fresh heartbeats and valid tracking. The page cannot confirm optical LED output. |

See [interface fields and timeouts](INTERFACE.md), [hosting](DATA_FOUNDRY.md) and [remaining physical checks](VALIDATION.md).
