# Team 2 · Bank Heist

[Play](https://data.id.tue.nl/web/djI6N01hckdUYks4bUZJeXE1RlhPY1hUQWxfRFl4bWd4NXpSRklGbmVvVUZ5U3dYTGxwbmVwWUdYQURTTG5iRGl3/) · [Download HTML](https://github.com/beraltan/team-2-software-module/raw/refs/heads/main/bank-heist.html) · [Hardware and firmware](https://github.com/beraltan/team-2-hardware-module)

Camera → Skidule → Morse → laser → vault → escape. Two players, ten minutes; three strikes cause lockdown.

Open **bank-heist.html** in Chrome or Edge. Choose offline practice, **Test your module**, or connect your crew. All devices must use the same team/channel; Team 2 uses `OOCSI-things/team-2`.

[Setup and playing](docs/DIY.md) · [Data exchange](docs/INTERFACE.md)

To edit: Node 22+, change `app/`, run `npm test`, then `npm start`. Preview at **http://127.0.0.1:8080**. Upload the rebuilt HTML to update Data Foundry. `npm run lab` generates `/test-output/device-lab.html` for local simulation.

Team 2: Anouk Kramer, Alp Altaner, Berk Eraltan Sönmezgil and Sebastiaan Schenk. Adapted from Toktik/OOCSI course material by Mathias Funk / TU/e, Group 7's Morse/Lampo, and Group 15's Skidule concept rebuilt from Miro.
