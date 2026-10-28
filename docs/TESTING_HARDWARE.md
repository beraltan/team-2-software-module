# Test hardware together

From the home screen, choose **Test your module**. Everyone can open this screen at once, including while one crew controller is connected to Team 2.

1. Power the ESP and connect it to Wi-Fi/OOCSI using its normal sketch.
2. Leave the channel at `OOCSI-things/team-2` and click **Connect test inputs**.
3. Select Camera, Laser, Skidule, Morse or Vault door. A sole discovered device is selected automatically; choose the intended ESP if several are present.
4. Use the real controls and inspect their readings, packet rate, last-input age and optional last incoming message. Each person can reset their local check independently.

- **Skidule:** the knob selects one of four bars, `slider` supplies 0–100 percent and the button shows its reported press count. **Start local lock check** uses the real controls to match/lock four local targets with the normal cold/warm/match rules.
- **Morse:** the button mirrors the lamp and released presses appear in five-signal rows. Check `2026` locally, then reset to repeat. This check has no dependency on another module's progress.
- **Laser:** unique beam-cut and finish-button events increment local counters. Events from any valid test `round_id` are shown; retries count once. The earlier level-based cut/clear protocol also retains held-beam suppression. This does not verify live round binding: in the actual heist the ESP must echo the controller's `laser_round_id`.

Laser **Start alignment mode** shows live beam detected/missing, raw input and
stale-status feedback for adjusting mirrors. It pauses only this bench's cut
and finish counters. The emitter stays continuously powered from USB VBUS/5V;
the page does not switch its power. Close or stop the real heist before
alignment if beam penalties would be disruptive. Receiver `state` packets
should arrive every two seconds; online heartbeats alone do not prove the
beam is detected. Exit alignment mode before testing actual cuts/finish.
- **Camera:** view incoming tracking validity, coordinates, sequence and a position plot. Camera light commands and floor calibration are checked from the live heist controller.
- **Vault door:** upload the [direct ESP32-S3 sketch](VAULT_DIRECT.md), then use explicit Test unlock/Test lock buttons to move both servos. Choose Automatic afterwards. The ESP rejects test commands during a fresh armed/running heist or controller conflict; the current crew presenter can still override it. The panel reports command acknowledgements and commanded angles, not measured movement.

The test connection subscribes and answers protocol keepalives. Observation and local puzzle checks do not publish application messages. Only an explicit Vault door button publishes a targeted vault command to the selected ESP/boot, with a recent status reference and unique request ID. The bench does not register a course controller, publish `toktik_*` heartbeats, send puzzle completions, deduct time or command camera lights. Each screen keeps its own local checks; these are not a shared heist session. Existing live hacker pages still require a single controller per team. Switch a friend's testing page to **Test your module** to remove its competing controller connection.

Direct links append `?test=skidule`, `?test=morse`, `?test=laser`, `?test=camera` or `?test=vault` to `bank-heist.html`. These links open the requested tab and wait for **Connect test inputs**. Return home to start the actual heist. Skidule also supports the friend's calibrated ten-position firmware by mapping its normalized knob onto four bars.
