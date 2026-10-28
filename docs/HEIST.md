# Shared heist controller

One ten-minute clock, anomaly count and round ID span the whole mission. The release follows the final report: **camera maze → Skidule → Morse → laser → vault release → escape**.

## Player journey

The infiltrator has the physical controls; the hacker sees the hidden map and security terminals. Choose your team for hardware, or offline practice. Module cards can be inspected freely; the objective and progress strip follow the mission sequence.

1. **Briefing and camera maze.** Check the room with the infiltrator at the entrance safe zone. Arm the heist at 10:00; departure starts the countdown. The hacker guides them around virtual walls using the camera's light. Reaching the marked vault area completes entry navigation without stopping the clock.
2. **Skidule.** The infiltrator turns the knob to select a bar, adjusts it with the slider and presses the button to lock a match. All four bars must be locked. The completed lock gives access to the physical numerical Morse clue. The app does not automatically manufacture or print this clue; prepare it with the props.
3. **Morse.** The infiltrator sends that numerical clue using the physical button. The hacker reads the flashes and enters the passcode (currently **2026**). Verification during an active mission requires Skidule complete.
4. **Laser.** Cross the mirror-directed beam and reach the finish button. Each accepted new break costs five seconds and one anomaly. In heist mode, cuts and finish events are accepted only while running in this stage. Early or faulted events cannot complete it.
5. **Vault and escape.** After all four stages pass, the fresh automatic vault controller commands both servos to unlock. The shared clock continues while the infiltrator returns with the money. Fresh radar arrival at the entrance stops it and shows the result. Door telemetry describes commanded angles, not measured door movement.

The [direct ESP32-S3 vault](VAULT_DIRECT.md) uses GPIO4/GPIO5. The [ESP-to-Uno arrangement](VAULT_BRIDGE.md) is an alternative. A new armed round relocks automatically; a reset or connection fault does not force an already-opened door closed.

## Time, penalties and recovery

Wall contacts during entry/escape and cuts during Laser share the configured penalty (default five seconds) and anomaly count. Three anomalies or zero time causes lockdown. Switching views or resetting one puzzle does not refill the clock. Arming clears ordinary practice results; deliberately bypassed modules remain visibly marked.

Radar tracking is required for entry and escape. The intermediate puzzles can run without a moving radar target. A lost connection, competing controller, hidden/suspended page or stale active puzzle can interrupt the mission. Reconnection never resumes it automatically.

Presenter controls can pass a failed module, bypass future laser penalties, explicitly resume after inspection or confirm safe return. Every assistance is labelled. Abort before resetting an active mission; **Reset entire heist** clears progress, time and anomalies. Keep one live crew controller per channel, visible and awake.

## Integration

Heartbeat fields include `heist_state`, `heist_phase` (`navigation`, `skidule`, `morse`, `laser`, `escape`), `heist_navigation_complete` and `heist_escape_bypassed`. The legacy `toktik_state` remains `idle` while armed; `won` means the completed escape. Completion events carry round/result IDs and bypass metadata. See the [full message contract](INTERFACE.md).

The 27 October handoff used the older laser-before-Skidule objective priority. This release changes that priority, the displayed acts and heist-only laser gating to match the final report. Saved firmware targets and pin mappings are retained.
