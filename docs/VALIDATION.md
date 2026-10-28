# Validation

## GitHub release — 28 October 2026

Source: the complete Team 2 presentation handoff dated 27 October. Its 109 web files matched the working source folder before import. This release changes objective priority and UI act order to **camera → Skidule → Morse → laser → vault release → escape**, and rejects laser cuts/finish events outside the running laser stage in heist mode.

- **108 JavaScript tests pass** with `npm test`, which also regenerates the standalone HTML and checks embedded script syntax.
- Full simulated runs solve all four modules without presenter bypass, for both the native four-bar controls and compatible ten-position packets. The vault stays locked after Morse, releases after the laser finish, and the timer stops on safe return.
- Regression coverage includes early/faulted laser finish rejection, shared penalties, duplicate and stale events, interrupted tracking/controls, explicit recovery, test-client isolation, vault targeting/acknowledgements and the generated screen's card/progress order.
- **Five laser/bundle protocol checks pass** from the paired hardware repo against this rebuilt HTML.
- C++17 syntax/assertion checks pass against the saved laser policy headers, direct vault policy/remote-command headers, and bridge/Uno gate/parser headers. These are not fresh full board compilations.
- Chrome offline preview verified arming, the corrected numbered cards/progress, labelled presenter passes, the final laser finish and the assisted completion screen. Browser warning/error logs were empty. That UI check used simulated inputs and no OOCSI connection.

No board was uploaded, servo moved or physical kit retested for this publication. The builder separately reported working camera tracking and RGB feedback after replacing the radar damaged on presentation day. No quantified position-error, latency, loaded servo-power or player-understanding results were supplied.

## Deployment and scope

The handoff records the 27 October HTML matching Data Foundry record 36 byte for byte, with 106 web tests and five backup protocol checks. The new progression changes the HTML, so the old deployment no longer represents this release. Updating GitHub does not update Data Foundry. Follow [the upload guide](DATA_FOUNDRY.md) to replace its entry file.

The exact teammate-calibrated ten-position Skidule sketch and original laser sketch were not recovered. Included replacements and board targets are identified in the [hardware handover](https://github.com/beraltan/team-2-hardware-module/tree/main/challenge-2). Saved sources are not a readback of every board's flashed firmware.

Before use, check the real Wi-Fi/channel, receiver polarity and voltage, input calibration, servo endpoints and power under load; then rehearse the whole sequence, penalties, fault recovery and restart with the actual kit. Keep one visible crew controller per channel. The camera's firmware heartbeat deadline is a fallback, not guaranteed delivery of the browser's final STOP.

Earlier standalone Python/USB adapters remain available for diagnostics. They are not the production combined controller and their historical checks do not establish physical heist operation.
