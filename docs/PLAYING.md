# Complete heist

The current one-file app uses the [full mission rules](HEIST.md): camera → Skidule → Morse → laser → vault release → escape, with a ten-minute shared clock. The camera-only rules below describe the original Challenge 1 standalone stage and its legacy 180-second engine defaults.

# Playing the heist

[Back to README](../README.md) | [Shared controller and integration](HEIST.md)

Two players, separate rooms, ten minutes. The infiltrator handles the physical bank; the hacker sees the hidden map and terminals. Cross the floor, pass the lasers, pick the four-bar lock, send the Morse override and return with the money.

## Briefing and start

1. Choose **Connect your crew** for live Team 2 hardware, or **Try the offline heist** to practise.
2. Keep one controller page visible and awake. Choose the Camera terminal, check radar orientation and the marked layout, and tick **Play area checked**.
3. Put the infiltrator in the blue entrance safe zone, then click **Arm the heist**. The shared clock waits at 10:00.
4. Leaving the safe zone starts the countdown. In the offline demo use map buttons or arrow keys to move the simulated player.

## The five acts

- **Cross the floor:** the hacker uses the map and direction controls. Reach the vault to complete entry. The clock keeps running.
- **Pass the lasers:** avoid beams and press the physical finish button. In offline practice, simulate the button on the Laser card.
- **Pick the lock:** potentiometer selects bar 1-4, slider changes height, and the button locks a MATCH. Cold/warm/match feedback guides the hacker. All four bars complete the lock.
- **Send the override:** the partner transmits the numerical code with the Morse button. Read the lamp and received dots/dashes, then enter the passcode after the lock is complete.
- **Get out:** return to the marked entrance safe zone. Radar confirmation stops the clock and opens the win screen.

Each terminal shows its own information. The heist clock, objective and shared anomaly count stay above every view. Switching cards keeps the mission running.

## Penalties and failure

Each new wall encounter or beam break deducts five seconds by default and adds one shared anomaly. Three anomalies trigger lockdown; time reaching zero also ends the heist. Return-trip walls count too. Locked module progress never cancels earlier penalties. A held legacy beam needs clearing; edge-based laser firmware must emit a unique ID only for each new break.

A required connection fault interrupts the heist visibly. It does not resume automatically. Inspect the kit before resetting or explicitly resuming through Presenter controls. Radar is needed during entry and return; the vault stages allow the camera to remain stationary or temporarily untracked.

## Presenter fallback

Presenter controls can bypass a module, disable future laser penalties, resume an inspected fault, or confirm return after all four modules are complete. Assisted results are labelled. **Abort heist** stops an active attempt; **Reset entire heist** prepares a fresh ten-minute mission. **Run another heist** on the result screen also resets the mission.

The software's getaway authorisation does not drive an unimplemented vault servo. Physical cue timing, sensor accuracy and delivery should be checked with the kit before the presentation.
