# Playing and operating

[Back to README](../README.md) · [First-time setup](DIY.md)

The infiltrator moves through the physical field. The navigator watches the map and holds direction controls to send LED cues. Reach VAULT before time expires while avoiding red maze walls. Defaults: 180 seconds, 5-second penalty per anomaly, lockdown at 3 anomalies.

## Before a round

1. Keep one controller page open for your team, visible with its screen awake.
2. Select the camera and check that one player is tracked correctly.
3. While idle, set field dimensions, Mirror X, difficulty and penalties, then apply. Changing the field or difficulty requires a new setup check.
4. Walk known points and mark START and VAULT from the current map. Keep bystanders outside the tracking area.
5. Confirm setup, place the infiltrator at START and start.

Default field: X −1.5 to +1.5 m, Y 1.5 to 3.5 m from the radar. Verify coordinate signs physically. Radar tracks body-position estimates, not individual footsteps.

## During play

Hold a guidance control to maintain a cue; release it for STOP. For someone facing the camera, intended directions are left = +X, right = −X, forward = −Y, back = +Y. Check the real LED interpretation first.

A wall-core contact or crossing between fresh samples causes an anomaly. One second clear of walls rearms detection. Walls are virtual penalty regions, so deliberate shortcuts can cost a penalty. See [maze details](MAZE.md).

The layout stays fixed during play. Reaching VAULT wins; expiry or the anomaly limit loses. Inspect and reset after every attempt. Check the new map before returning to START.

## Faults and recovery

Tracking loss, camera restart, network loss, competing controllers or a hidden/suspended page can fault a round. Reconnection does not resume it. Fix the cause, reset and confirm setup again.

For controller conflicts, close extra controller pages, wait three quiet seconds and reset. [Troubleshooting](TROUBLESHOOTING.md) covers other failures.

Closing the browser does not stop camera publishing. To disable it, reconnect by USB, untick publishing in camera setup and save.

## Offline demo

Choose **Try offline demo** in the opening dialog, confirm setup and start. Move with the buttons or arrow keys. It simulates positions without OOCSI; simulated guidance does not verify physical LEDs or radar.
