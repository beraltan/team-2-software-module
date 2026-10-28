# Laser grid and penalties

The fourth module card is **Laser grid**. The physical finish button completes this stage; the vault can then unlock, and the clock continues until safe-zone return. See [mission flow](HEIST.md). A laser cut deducts the configured anomaly penalty (default **5 seconds**) and adds **one anomaly** during the running laser phase after Camera, Skidule and Morse. Maze-wall and laser anomalies share the same lockdown limit (default **3**). Cuts after the Laser card is complete are ignored.

## Presentation controls

Open **Presenter controls** and use **Record laser cut (-5s)** during the laser stage, or **Simulate laser cut (-5s)** in the offline demo. The timer and anomaly count update immediately, and a red laser-cut notice appears. Manual recording requires the running laser stage and, in live mode, a connected controller without a conflict.

**Bypass laser penalties** ignores future cuts without passing the module. **Bypass and pass Laser** completes the card with explicit presenter-bypass metadata. Neither refunds earlier penalties or resumes a failed camera attempt. Use **Reset laser module** to clear completion and create a fresh input round. The offline Laser card has **Simulate finish button**. Changing the penalty or anomaly limit in Camera settings also changes laser penalties.

Switching cards preserves a completed Laser card. Resetting the entire heist clears all module progress and cut counts. Laser reset clears its completion and bypass but does not refund the camera's existing anomaly count.

## ESP / OOCSI input

The laser ESP must use the same team channel as the screen: **`OOCSI-things/team-2`**. The screen accepts the supplied `beam_broken` and `button_pressed` message format. See the [saved firmware and illustrated circuit](https://github.com/beraltan/team-2-hardware-module/tree/main/challenge-2) for the XIAO C3 implementation. The saved replacement still needs a check against the actual board’s wiring and receiver polarity before upload.

Listen to the screen's **`laser_round_id`** heartbeat and copy its current nonempty value into each event's `round_id`. Starting camera navigation binds an incomplete laser attempt to `toktik_round_id`; before navigation or after a laser reset, use `laser_round_id`. Do not hardcode the example `round-003`. A cut packet's `data` is:

```json
{"module":"laser","device_id":"team2-laser","event":"beam_broken","beam_id":1,"event_id":"boot42-17","round_id":"CURRENT_LASER_ROUND_ID"}
```

Emit **one new event ID per physical clear-to-broken edge**. Retries of the same break must reuse its event ID. Each new `beam_broken` ID represents another break, so this protocol does not require a separate clear message. A held beam must not generate fresh IDs repeatedly. Stable `device_id` deduplicates retries even if the OOCSI sender name changes. Beam/event IDs can be nonempty strings up to 96 characters or nonnegative safe integers; device/round IDs must be nonempty strings up to 96 characters.

The finish button packet does not need a beam ID and never adds a penalty:

```json
{"module":"laser","device_id":"team2-laser","event":"button_pressed","event_id":"boot42-18","round_id":"CURRENT_LASER_ROUND_ID"}
```

It marks only the Laser card complete and increments the four-module progress total. Repeated button events do not create more results. Completion does not finish or restart the shared heist clock. Old-round packets, malformed events and packets received while disconnected, conflicted or in the startup listening period cannot complete the module or charge a cut.

## Earlier cut/clear input

The earlier `event: "cut"` format is still accepted with `beam_id`, `event_id` and the current `round_id`; `device_id` is optional and sender identity is the fallback. Unlike `beam_broken`, another `cut` on that beam needs `event: "clear"` first. A cut retry stays ignored even after clear. A cut received during penalty bypass stays blocked until clear, preventing a held-beam replay on re-enable.

For reconnection or periodic baseline reports, send a state packet. A state report never charges a penalty; `broken: true` blocks a beam until it clears, and `broken: false` rearms it. Emit a separate cut event on each new physical clear-to-broken edge.

```json
{"module":"laser","event":"state","round_id":"CURRENT_LASER_ROUND_ID","beam_id":"A","broken":false}
```

An optional heartbeat every two seconds lets Presenter controls display that a laser ESP is connected:

```json
{"module":"laser","event":"online"}
```

That connection indicator expires after six seconds. Laser loss does not fault navigation; manual recording remains available. All valid beam sources on the team channel are accepted without a device picker.

## Completion output

The shared heartbeat includes `laser_cuts`, `laser_bypassed` (penalty bypass), `laser_state`, `laser_solved`, `laser_round_id`, `laser_result_id` and `laser_completion_bypassed` (module pass by presenter).

One atomic completion message uses `module: "laser", event: "solved", solved: true, puzzle_id: "laser"`, the unique `result_id`, `puzzle_round_id`, parent heist `round_id` when available, `bypassed` and `completion_method`. Physical completion also includes `device_id` and `input_event_id`; the connection adds `team: 2` and `controller_session`. Live publication uses the existing shared connection; offline mode sends nothing. This result does not command a physical latch.
