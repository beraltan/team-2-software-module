# Data exchange

Physical devices communicate through **oocsi.id.tue.nl**, channel **OOCSI-things/team-2**. Firmware uses TCP 4444; the browser uses `wss://oocsi.id.tue.nl/ws`. Choose the same team everywhere and keep one live crew controller.

OOCSI supplies `{sender, recipient, data}`; the examples below show `data`. The browser combines the heist controller, Skidule and Morse receiver in one application, exchanging their round/reset/completion state internally in JavaScript.

## Inputs

| Device | Data fields and units |
| --- | --- |
| Radar | `radar_boot` string, increasing `radar_seq`, `radar_valid` boolean, `radar_x_mm` / `radar_y_mm` in millimetres; `guidance_supported` advertises LEDs. About 5 Hz. |
| Skidule | `module: skidule_controls`, `boot_id`, `seq`, `bar_index` 0–3, `slider` 0–100%, `button_press_count`; events `online`, `state`, `pressed`, `released`. About 10 Hz plus button edges. |
| Morse | `module: morse_button`, `state: pressed/released`, `lampo_toggle` boolean; release `duration_ms` in milliseconds. |
| Laser | `module: laser`, `device_id`, `boot_id`, `round_id`, `event`; cuts/finish include unique `event_id`. Cuts identify `beam_id`. Receiver `state` reports support alignment. |
| Vault | `module: vault_door`, `event: state`, `device_id`, `boot_id`, increasing `seq`, `mode`, `commanded`, `motion`, two `angles` and `target_angles` in degrees, `servo_confirmed: false`. |

Radar coordinates start at the sensor; +Y points away. Verify X orientation physically. `bar_height` 0–1 takes precedence over `slider` when supplied. Legacy ten-position Skidule packets map their normalized `knob` onto four bars.

```json
{"radar_boot":"boot-a","radar_seq":42,"radar_valid":true,"radar_x_mm":-900,"radar_y_mm":1800,"guidance_supported":true}
```

```json
{"module":"laser","device_id":"laser-a","boot_id":"boot-b","event":"beam_broken","event_id":"boot-b-7","beam_id":1,"round_id":"current-laser-round"}
```

Laser events use the browser's current `laser_round_id`: `beam_broken` applies a penalty and `button_pressed` completes Laser. Repeated event IDs cannot charge twice; old rounds are ignored. The archived C3 implementation sends receiver states every two seconds and does not replay outages. A `test-...` round can feed the test bench without completing a live heist.

Morse mirrors actual presses; it does not automatically decode the answer. Releases shorter than 400 ms appear as dots; 400 ms or longer appear as dashes. The hacker validates the passcode manually.

## Browser heartbeat and results

The connected controller broadcasts at **5 Hz**:

- `toktik_session`, increasing `toktik_beat`, `toktik_round_id` and selected `toktik_camera`;
- `toktik_state`, `toktik_time_s`, `toktik_penalties`, `toktik_ready`, `toktik_guide` (`left/right/forward/back/stop`);
- `heist_state`, `heist_phase`, `heist_navigation_complete`, `skidule_solved`, `morse_solved`, `laser_solved`;
- each puzzle's state, round/result IDs and bypass flags.

Phases follow `navigation → skidule → morse → laser → escape`. `toktik_state: won` means the completed safe-zone return, not camera entry. The vault requires all four completion flags, the escape phase and a fresh controller lease.

Puzzle completion also produces an atomic result with `puzzle_id`, `solved`, `result_id`, `round_id`, `puzzle_round_id`, `bypassed` and `completion_method`. Deduplicate result IDs and validate the expected round. Presenter passes use `bypassed: true` and `completion_method: presenter_bypass`.

Explicit vault commands use `module: vault_control`, `event: command`, `command`, `scope`, `requester_session`, `request_id`, `device_id`, `boot_id` and `status_seq`. The receiver checks the selected device/boot and a recent status. Test commands are rejected during an active heist or controller conflict. Telemetry describes commanded angles; there is no servo position sensor.

## Stale inputs and recovery

Reject malformed, old and duplicate packets. Radar samples older than 450 ms cannot trigger play; a one-second tracking loss faults active navigation. Skidule becomes stale after 2.5 seconds and Morse after 25 seconds. Device reboots and network/controller conflicts fault affected active attempts. Restore the connection and reset deliberately; reconnecting does not silently resume a failed attempt.

The camera applies guidance only with fresh control and valid tracking, stopping when the heartbeat is two seconds old. Idle LED output is off. Keep the browser visible and awake; the test bench observes inputs without broadcasting a competing heist heartbeat.
