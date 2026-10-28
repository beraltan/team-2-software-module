# Local device emulation

Run `npm run lab`, then start the local preview (`npm start`, port 8080 by default).
Open `/test-output/device-lab.html` in the same browser and keep it visible.
The current testing session uses port **8127**.

The gold banner identifies this isolated fixture. Its WebSocket replacement
prevents connections to OOCSI: choosing Team 2 exercises the real live-mode
receiver without publishing to your friends' channel. The production
`bank-heist.html` does not contain the emulator.

1. Connect your crew, choose Team 2 and wait for automatic device selection.
   If a previous attempt was interrupted, use **Reset heist**.
2. Check **Play area checked**, then **Arm the heist**. The clock stays at ten
   minutes until departure. Click **Walk entry route** after the arm heartbeat.
3. **Cut laser beam** applies one five-second deduction and anomaly.
   **Repeat same laser event** reuses its event ID and must not charge again.
   **Finish laser** sends the physical finish-button message.
4. Open Skidule, click **Start lock**, then **Solve four bars**. The emulator
   searches slider positions using broadcast cold/warm/match feedback and sends
   actual press/release edges. It does not read hidden targets or invoke bypass.
5. Open Morse and click **Send Morse 2026**. It sends `..--- ----- ..--- -....`
   using 200 ms dots and 600 ms dashes. Enter the decoded code and verify it.
6. Open **Vault door**. The emulated S3 requires two controller heartbeats and
   sweeps its two commanded angles from 90 to 0 degrees at 20 degrees/second.
   It should unlock only when all four modules pass and escape begins.
7. **Walk escape route** returns through the published maze. The normal
   safe-zone detection produces the win screen and stops the shared clock.

The camera publishes positions at 5 Hz; Skidule publishes state at 10 Hz.
The default Skidule emulates the friend's normalized ten-position firmware.
The automated run also checks native four-bar, 0–100 percentage packets.
Routes use only public maze geometry in outgoing controller messages.
The vault and laser models follow the firmware's heartbeat lease rules.

`npm test` includes full round-trip runs without bypass for both Skidule
formats, old-round rejection, duplicate events, wrong Morse code, simulated
servo completion, timer stopping, reset/rearm, camera and Skidule outages,
three-cut lockdown, and vault ownership/replay/conflict handling.

This is protocol and application testing, not CPU-level ESP emulation. It does
not test the Wi-Fi radio, actual OOCSI TCP implementation, LD2450 tracking,
electrical inputs, physical servo position, or USB power under load. The laser
receiver/button pins and polarity still need checking on the actual kit.
