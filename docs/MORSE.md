# Morse / Lampo override

The third hacker-screen card adapts the user-supplied Group 7 Morse interaction to Team 2's UI. A physical button lights the on-screen lamp while held and switches it off on release. The hacker reads the short/long flashes and types the passcode. Clear extinguishes the lamp and focuses the answer field. There is no automatic translation or generated Morse message. The original passcode remains **2026**, checked after trimming spaces and converting to uppercase.

## Connect for Team 2

Select **Team 2** in `bank-heist.html`. The exact channel is **`OOCSI-things/team-2`**. `OOCSI-things/team2` is a different channel and will not work.

The supplied `Challenge1.team7/DCE_morse/DCE_Morse/DCE_Morse.ino` was updated to that channel and a Team 2 client name. Its `pin_config.h` is now also inside the sketch folder. Keep a unique client name per ESP. Existing wiring and debounce remain unchanged: the supplied DFRobot red button is active HIGH on GPIO21 with INPUT_PULLDOWN, 25 ms debounce, and a ten-second heartbeat. This change does not flash a connected board or change its Wi-Fi settings. Re-upload the updated sketch to apply the channel change on the ESP.

For a XIAO ESP32-C6, the self-contained [Morse_Button.ino](../examples/Morse_Button/Morse_Button.ino) needs no extra header: signal goes to **D3 / GPIO21**, button power to **3V3**, and ground to **GND**. It preserves the active-HIGH DFRobot wiring, supplies release duration and sends a heartbeat every five seconds. D4 is GPIO22; change `BUTTON_PIN` only if the button is actually wired there. For a bare two-wire switch to ground, set `BUTTON_ACTIVE_LOW = true`. Configure Wi-Fi locally; the client name derives from the board ID. It was compile-checked with ESP32 core 3.3.11, OOCSI 1.6.0, ArduinoJson 7.3.2 and FQBN `esp32:esp32:XIAO_ESP32C6:CDCOnBoot=cdc`. Physical upload and delivery still require the friend's connected board.

Open the **Morse signal** card. A sole device is selected immediately, including its first button edge, so discovery does not delay the first flash. If several senders are present, a selector is available; Clear the active signal before changing devices. Selecting a source does not replay old button edges. Switching cards preserves the receiver state and never steals the visible view when a signal arrives.

The lamp and terminal remain visible together. Lamp updates subscribe directly to incoming messages rather than waiting for the general 100 ms dashboard refresh. Network latency and the original unsequenced protocol can still affect timing.

Below the lamp, **Received signals** shows dots and dashes in rows of five. Each completed press adds a mark: under 400 ms is a dot; 400 ms or longer is a dash. The original ESP's `duration_ms` takes precedence over network arrival timing. Offline practice and packets without a duration use the measured press interval. A release without a preceding observed press, duplicate releases, and stuck/faulted presses do not create extra marks. The last six complete/partial rows are retained; the counter records all marks since Clear. Clear signal, Reset receiver and source changes empty this strip. Completion keeps it visible. These are received marks for the hacker to read, not automatically decoded letters or passcode validation.

## Original input messages

OOCSI events use `{sender, recipient, data}`. These examples are `data`:

```json
{"module":"suitcase","event":"online","uptime_s":120}
{"module":"morse_button","state":"pressed","lampo_toggle":true}
{"module":"morse_button","state":"released","lampo_toggle":false,"duration_ms":200}
```

Boolean `lampo_toggle` takes precedence; otherwise `state` must be `pressed` or `released`. Only the selected sender controls the lamp. `duration_ms` classifies the released press into a dot/dash for the received-signal strip, without translating it into text. The original firmware has no boot/sequence IDs or replay mechanism, so this adapter cannot guarantee network ordering or recover a lost transmission.

The source counts as offline after 25 seconds without a valid packet. An active transmission faults on that outage, an observed uptime rollback, socket loss, another controller, a hidden/suspended tab, or ten seconds of uninterrupted light without release. Faults turn the lamp off. Reset deliberately to receive again. Clear alone does not resume a faulted receiver. Like the original page, verifying the correct code is possible without hardware or prior flashes.

## Completion and demo fallback

Correct verification sends one atomic result through the existing shared connection:

```json
{"module":"terminal","event":"solved","team":2,"solved":true,"puzzle_id":"morse","result_id":"unique-id","round_id":"heist-round-or-morse-attempt","puzzle_round_id":"morse-attempt","bypassed":false,"completion_method":"played","controller_session":"existing-session"}
```

`module: "terminal"` and `event: "solved"` retain the original notification. The heist round is used if available; otherwise a Morse attempt supplies its own round ID. Consumers should deduplicate `result_id`. The selected numeric team is added by the connection adapter. Heartbeats retain `morse_state`, `morse_lamp`, `morse_solved`, `morse_bypassed`, `morse_round_id` and `morse_result_id`. There is one controller/Thing registration for all four cards. Passing this module does not directly drive a physical vault servo.

**Presenter controls → Bypass and pass Morse** accepts the module without hardware or a code, including after a fault. Its normal terminal result has `bypassed: true` and `completion_method: "presenter_bypass"`. Reset clears the completed/bypassed state. Completion notifications can only leave the browser while connected and free of a controller conflict; local pass still works offline. Page reload or changing connectivity/team clears passes.

Offline practice has a hold-to-flash button with pointer and Space/Enter support. It produces the same button interaction locally and sends no OOCSI data.
