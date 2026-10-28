# ESP32-S3 to Uno vault door

This implementation uses the pictured ESP32-S3 for Wi-Fi/OOCSI and the **Arduino Uno R3 (ATmega328P)** for the two MG90S servo signals. It works with the currently published heist heartbeat; no new browser command or game-module card is required.

The supplied Uno sketch attached servos to **D9/D10** and swept both together from **90 degrees to 0 degrees**, one degree every 50 ms. Those pins, same-direction movement, speed and Servo.h pulse mapping are preserved. This handoff assumes **90 = locked, 0 = unlocked**. Swap `LOCKED_ANGLE` and `UNLOCKED_ANGLE` if the mechanism is reversed. Calibrate each array element separately if the two horns are mounted differently.

## Files and wiring

- [ESP32-S3 sketch](../examples/Vault_ESP32S3_Bridge/Vault_ESP32S3_Bridge.ino): upload with its two `.h` files in the same sketch folder. Add the local Wi-Fi name/password. Libraries: OOCSI 1.6.0 and ArduinoJson 7.x; ESP32 Arduino core 3.x.
- [Uno sketch](../examples/Vault_Arduino_Uno/Vault_Arduino_Uno.ino): upload with `CommandLine.h` in its folder. No additional library is required; SoftwareSerial comes with the AVR core.

| Connection | Destination |
| --- | --- |
| ESP32-S3 **GPIO4** | Uno **D2** (command RX) |
| ESP **GND** | Uno **GND** |
| Servo 1 signal | Uno **D9**, as before |
| Servo 2 signal | Uno **D10**, as before |
| Both servo power wires | Existing working Uno **5V/GND** wiring |

Power the ESP and Uno from their own USB cables. The bridge needs only GPIO4-to-D2 and a shared ground. Leave Uno D3 and ESP GPIO5 unconnected. Do not connect a 5V Uno TX signal to an ESP input, and do not join the boards' 5V rails when both are USB powered. Uno D0/D1 remain available for USB upload/monitoring.

It is possible for the existing Uno USB arrangement to move two lightly loaded servos. This does not establish enough current for the loaded door: check for resets, USB disconnects, struggling servos and mechanical binding. The code cannot increase USB power. Keep servo power on 5V, never a GPIO or 3V3 pin. See [Arduino's servo power guidance](https://support.arduino.cc/hc/en-us/articles/360017053760-Troubleshoot-servo-motors).

## Automatic operation

The ESP listens on **`OOCSI-things/team-2`**, server **`oocsi.id.tue.nl`**. It follows increasing `toktik_beat` messages from a single `toktik_session`, requiring two fresh heartbeats before moving anything.

- Arming a new heist sends **LOCK**. A newly connected bridge can also lock during an unfinished active round.
- The bridge sends **UNLOCK** when `heist_state` is `running` or `won`, `heist_phase` is `escape`, the round ID is present, and camera entry, Laser, Skidule and Morse are all complete. Presenter passes are included in those states.
- Idle practice results, individual `terminal/solved` events and offline demo pages do not open the door.
- Commands stop on stale/conflicting controller messages. Idle/reset, faults, lockdown and connection loss do not force the door closed. Once this bridge has unlocked a round, resetting one puzzle in that same round does not relock it. **Arm a new round after physically preparing the door** to relock.
- A valid command is repeated once per second while its controller lease is fresh. This lets an Uno reconnect without receiving every heist heartbeat. Duplicates do not restart its sweep.

The Uno waits for the first valid command before generating servo pulses. It then moves toward the requested position without blocking the command loop. Full 90-to-0 travel takes about **4.5 seconds**, matching the supplied sketch. It uses Timer1 hardware pulses on D9/D10 so SoftwareSerial's interrupt timing does not stretch servo pulses; do not also load Servo.h or another Timer1 user into this sketch.

The command wire carries `VAULT1,LOCK\n` or `VAULT1,UNLOCK\n` at 9600 baud. Complete exact lines only are accepted; overlong, binary and timed-out partial lines are discarded. There is no return wire or position sensor. OOCSI status uses `module: vault_bridge`, `event: state`, `commanded`, `mode`, `controller_link`, `controller_session`, `round_id`, and **`servo_confirmed: false`**. These report commands, not measured door movement. They do not publish `toktik_session` or take control of the heist.

## Local checks before attaching the door

1. Upload the Uno sketch and open its Serial Monitor at **115200**, newline enabled. Send **OPEN**, then **CLOSE**. Both servos should follow the same motion as the original sketch. These commands enable local override; send **AUTO** afterwards so it accepts ESP commands. **STATUS** reports commanded angles/targets.
2. Upload the ESP sketch. Its Serial Monitor at 115200 accepts **U** (manual unlock), **L** (manual lock), **A** (return to automatic mode) and **S** (local status). Manual U/L tests work even before Wi-Fi credentials are filled in. The Uno must be in AUTO. End the test with **A** on the ESP and **AUTO** on the Uno.
3. Use one live crew controller, arm a round and verify the latch goes to its locked position. Finish or deliberately bypass all four modules; it should unlock during escape, while the shared clock continues until safe-zone return. Verify that a practice Morse result from the idle screen cannot open it.
4. Check the same sequence with Serial Monitors closed, then power cycle each board separately. Check actual door loading and endpoints before the presentation. A command/status message alone does not prove physical movement.

The sketches are compiled and their policy/parser checks are recorded in [validation](VALIDATION.md). No board has been flashed here, and the actual USB current margin, wiring, servo endpoints and door motion remain physical checks. OOCSI is public; this is a presentation prop controller, not an access-control lock.
