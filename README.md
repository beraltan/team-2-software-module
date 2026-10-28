# Team 2 · Bank Heist

[Play Bank Heist](https://data.id.tue.nl/web/djI6N01hckdUYks4bUZJeXE1RlhPY1hUQWxfRFl4bWd4NXpSRklGbmVvVUZ5U3dYTGxwbmVwWUdYQURTTG5iRGl3/) · [Download HTML](https://github.com/beraltan/team-2-software-module/raw/refs/heads/main/bank-heist.html) · [Hardware & firmware](https://github.com/beraltan/team-2-hardware-module)

One hacker screen for the camera maze, Skidule lock, Morse terminal, laser grid and vault. **Camera → Skidule → Morse → laser → vault release → escape**, with one ten-minute clock. Each anomaly costs five seconds; three cause lockdown.

## Run

1. Download **bank-heist.html** and open it in Chrome or Edge, or [upload the single file to Data Foundry](docs/DATA_FOUNDRY.md).
2. Choose offline practice, **Test your module**, or connect your crew. Live Team 2 uses **OOCSI-things/team-2** on every device.
3. Check the room, inputs and vault in the test bench. Use one crew controller for the live heist. Presenter controls provide labelled bypasses if needed.

[Setup guide](docs/DIY.md) · [Heist rules](docs/HEIST.md) · [Hardware tests](docs/TESTING_HARDWARE.md) · [Message contract](docs/INTERFACE.md)

## Edit

Install Node.js 22 or newer. Edit [app/](app/), then run:

```sh
npm test
npm start
```

Tests rebuild the standalone HTML. Preview at **http://127.0.0.1:8080/bank-heist.html**. No npm dependencies are needed. [Development tools](docs/DEVELOPMENT.md) · [Validation](docs/VALIDATION.md)

Source comes from the 27 October handoff, with progression updated to the final report order. The hosted page remains the previous deployment until the new HTML is uploaded. The exact teammate-calibrated Skidule and original laser sketches were not recovered; the hardware repo identifies the included replacements.

Team 2: Anouk Kramer, Alp Altaner, Berk Eraltan Sönmezgil and Sebastiaan Schenk. Adapted from Toktik / Mathias Funk / TU/e, Group 7 Morse/Lampo and Group 15 Skidule. [Credits and terms](THIRD_PARTY.md).
