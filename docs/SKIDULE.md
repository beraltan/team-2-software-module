# Hacker module cards and Skidule

Open `bank-heist.html` and choose a team, or use the offline demo. The four cards select Camera navigation, Skidule lock, [Morse signal](MORSE.md) and [Laser grid](LASER.md). Switching cards changes the visible panel, not the shared OOCSI connection or active attempts. Keep the browser tab visible. The shared heist clock continues across all terminal views. See [mission flow](HEIST.md).

## Play the lock

1. Flash the Team 2 [Skidule_Controls.ino](../examples/Skidule_Controls/Skidule_Controls.ino) onto the XIAO ESP32-C6. Configure its Wi-Fi credentials locally and use the same team channel as the hacker screen. Team 2 is `OOCSI-things/team-2`.
2. Select the Skidule card. If just one ESP is sending on your team channel, it is selected automatically and shown as **Connected: device name**. If several are sending, use **Physical controls** to choose one. It is separate from the radar selector inside the Camera module, which also selects a sole camera automatically. Discovery listens for three seconds on connection. A chosen device is never silently replaced during an attempt or an outage.
3. Click **Start lock**. Each of the four bars gets a hidden target height from 10% to 90%.
4. The knob selects bar 1-4. The slider adjusts the selected unlocked bar. Feedback is COLD (blue diamond), WARM (orange triangle, within 15 percentage points), or MATCH (green circle, within 4 percentage points).
5. A button press locks a matching bar. An unmatched bar stays unlocked. Press again to unlock a locked bar. Locked bars ignore slider changes. Four correct locks complete and freeze the attempt until reset.

The offline practice panel simulates the knob, slider and button. It sends no network data. Selecting another module does not reset its progress. Targets are excluded from the display snapshot.

Controls silent for 2.5 seconds, an ESP reboot, network loss, conflicting controllers, or a hidden/suspended browser fault an active lock. Fix the cause and reset deliberately. A late packet cannot silently resume an invalid attempt.

## Updated four-bar ESP sketch

The linked sketch sends zero-based `bar_index` 0-3 and `bar_count: 4`. The page also accepts the friend's currently flashed ten-position sketch: when it supplies normalized `knob` 0-1 and either `bar_count: 10` or no bar count, selection is calculated as `min(3, floor(knob * 4))`. Its raw index 0-9 is validated but does not select a fifth bar. The UI identifies this compatibility mapping. No reflash is required for that packet format.

The sketch has separate `SLIDER_RAW_MIN/MAX` and `KNOB_RAW_MIN/MAX` constants. Defaults are 0-3270, based on the reported kit maximum; measure both controls independently and adjust their endpoints for the physical unit. Inputs are clamped to 0-1, so all four knob positions and the full slider height are reachable. Raw values stay in `slider_raw` and `knob_raw` for calibration. The updated sketch sends `slider` as 0-100 and also retains normalized `bar_height` for earlier receivers.

With USB CDC enabled, `Serial.setTxTimeoutMs(0)` is set and debug logging defaults off. If enabled for calibration, loop logging only writes when the serial output has room. Sampling stays at 10 ms, debounce at 25 ms, periodic state at 100 ms, with immediate debounced press/release events. OOCSI reconnection can still block; no button presses are replayed after an outage.

After upload, test with the serial monitor closed: roughly ten state messages each second while connected, every bar 1-4 selectable, slider height spanning 0-1, and normal short taps registering once. Existing local Wi-Fi credentials should be preserved by the friend's Codex; the shared sketch contains placeholders.

## Presentation fallback

Open **Presenter controls** below the module cards and click **Bypass and pass Camera** or **Bypass and pass Skidule**. This passes that module even before starting or after a failure, without requiring hardware or a working network. Switch to the next card to continue. The card says **Passed / bypass**; the normal reset for that module clears the pass. Passes apply to the current page session and are cleared on page reload or changing connectivity/team.

Camera bypass completes entry navigation; in a full heist, `toktik_state: "won"` remains reserved for the completed escape. Skidule bypass uses `skidule_state: "solved"` so puzzle listeners can continue. Heartbeats also include `toktik_bypassed` and `skidule_bypassed`. Skidule's atomic solved result adds `bypassed: true` and `completion_method: "presenter_bypass"`; `locked_count` still reports the actual number of locked bars. Repeated bypass clicks do not create new completion IDs. Camera guidance stops on bypass. The result and heartbeat can only reach other modules while OOCSI is connected and there is no controller conflict; local fallback still works offline. Bypass does not command a physical vault servo.

## Input contract

Messages arrive as OOCSI `{sender, recipient, data}` events. `data` must contain:

```json
{
  "module": "skidule_controls",
  "event": "pressed",
  "boot_id": "d97e102a",
  "seq": 42,
  "bar_index": 3,
  "bar_count": 4,
  "slider": 52,
  "button_press_count": 2
}
```

Native `bar_index` is an integer 0-3; native `bar_count`, when supplied, is 4. The compatibility mapping above also accepts the calibrated ten-position firmware. `slider` is a finite percentage 0-100 (50 means 50%). The earlier `bar_height` field is accepted as a normalized 0-1 height; when both fields are supplied, `bar_height` takes precedence. This correctly handles the friend's normalized `slider` plus `bar_height` without confusing it with percentage input. The internal puzzle always uses a height of 0-1. `seq` increases within a `boot_id`. Supported events are `online`, `state`, `pressed`, and `released`. A confirmation requires `pressed` and a new press count. Periodic messages with a held button do not repeatedly toggle a lock. Height and selection are applied from the same confirmation packet. Boot changes fault active attempts; malformed, duplicate and old messages are ignored.

The course Thing announcement now lists Skidule and other module inputs alongside camera inputs. These are discovery metadata; gameplay has always subscribed to whole messages on the team channel, not just its advertised camera fields. Being idle means the lock has not started; incoming selection and slider readings should still update.

## Completion and feedback

The existing controller heartbeat adds `skidule_state`, `skidule_round_id`, `skidule_selected_bar`, `skidule_feedback`, `skidule_locked_count`, `skidule_bar_count`, `skidule_solved`, and `skidule_result_id`. The solved state and result ID remain available in subsequent heartbeats.

On completion the same controller also publishes one atomic result:

```json
{
  "module": "skidule",
  "event": "solved",
  "solved": true,
  "locked_count": 4,
  "bar_count": 4,
  "puzzle_id": "skidule",
  "result_id": "unique-result-id",
  "round_id": "camera-round-id-or-lock-attempt-id",
  "puzzle_round_id": "lock-attempt-id",
  "controller_session": "existing-controller-session"
}
```

When a camera round already exists, its round ID is captured when the lock starts. Otherwise the lock attempt supplies the round ID. A downstream controller must validate its expected round and deduplicate the result. This event reports completion of Skidule, not completion of Morse or physical opening of a vault.

Puzzle publications use the existing socket without overwriting Toktik's course variables or creating another controller. Feedback is visible on screen and included in heartbeats; the older camera firmware still needs an adapter to display cold/warm/match as LED cues. The navigation rules, their timer and guidance behavior are otherwise retained.
