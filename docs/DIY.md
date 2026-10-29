# Setup and playing

[Hardware assembly, wiring and firmware](https://github.com/beraltan/team-2-hardware-module) · [Data exchange](INTERFACE.md)

## Set up

1. Download the actual `bank-heist.html` file and open it in Chrome or Edge. No Python, Node or neighbouring files are needed to play.
2. Put the ESPs and browser on an internet-connected network. For the camera, join `team2-radar` (password `aqswdefr`), open `http://192.168.4.1`, enter a 2.4 GHz personal network/hotspot and enable OOCSI sharing. Other devices use the hardware repo's Wi-Fi build configuration.
3. Choose the same team on every device and in the browser: Team 2 is `OOCSI-things/team-2`. Select the intended device when several are discovered.
4. Use **Test your module** before starting. Check radar coordinates, all four Skidule selections and slider range, Morse press/release flashes, laser cuts/finish and vault lock/unlock. Return the vault to Automatic.
5. Mark the camera's tracked field and entrance safe zone. Verify left/right and near/far movement with the installed radar and shell. Keep the infiltrator facing the camera LED. Use one live controller tab and keep it visible.

OOCSI is public. Offline practice sends no gameplay data; live mode shares positions and game state on the selected channel.

## Play

The hacker sees the hidden map and puzzle feedback; the infiltrator operates the physical props. The intended arrangement uses separate rooms and no direct speech. Brief both players on the controls and LED cues first.

1. **Camera:** check the play area, arm the heist and leave the entrance safe zone to start the ten-minute clock. Follow camera-light guidance through the maze.
2. **Skidule:** the knob selects one of four bars, the slider changes its height and the button locks a matching bar. All four locks reveal the Morse code.
3. **Morse:** transmit the code using short/long button presses. The hacker reads the flashes/dots/dashes and enters **2026** for validation.
4. **Laser:** reach through the reflected beam path and press the finish button. The vault releases after all four stages are complete.
5. **Escape:** take the money back to the entrance safe zone before time expires.

Each new wall/laser violation costs five seconds and one strike. Three strikes or zero time cause lockdown. Skidule feedback currently stays on the hacker's screen; relaying it through the camera LED is not implemented.

| Camera cue | Meaning |
| --- | --- |
| Blue, 1 / 2 pulses | Left / right |
| Green, 3 / 4 pulses | Forward / back |
| Steady red | Stop |
| Blinking amber / off | Fault / idle |

## Checks and recovery

**Test your module** lets several people check inputs independently without becoming game controllers. Laser alignment shows detected/missing/stale beam status and pauses local counters; the emitter stays on. Explicit vault test buttons move the selected device. An acknowledgement reports a command, not measured motor movement.

If a device disappears, check Wi-Fi, the exact team/channel and device selection. For missing radar data, check 5V, common ground and crossed TX/RX. The camera LED is deliberately dark while idle.

A live connection or stale-input fault interrupts play. Fix the cause and reset deliberately. Close extra crew controllers before recovering. Presenter controls provide labelled bypasses; they are assisted results. A puzzle reset preserves the shared clock/strikes; **Reset entire heist** starts a fresh run.

## Host on Data Foundry

Upload only `bank-heist.html` to an **Existing Dataset**, enable **Web Access**, and select that file as the entry point. Share the playable URL. After code changes, run `npm test` and replace the hosted HTML with the rebuilt file.
