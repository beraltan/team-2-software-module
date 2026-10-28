The complete shared-config [firmware and build instructions](https://github.com/beraltan/team-2-hardware-module/tree/main/challenge-2) are in the hardware repo. The copies in `examples/` retain the earlier standalone sketch format.

# ESP32-S3 only vault door

The saved ESP32-S3 sketch drives two hobby-servo signal wires directly. Earlier wiring notes name MG90S; the project parts list specifies two SG90s. The saved signal mapping is GPIO4/GPIO5 for either; confirm the fitted servos, power path and mechanical endpoints. The Uno is not needed. Use the complete `Vault_ESP32S3_Direct` sketch folder, including its four headers. Add Wi-Fi credentials locally; it subscribes to **oocsi.id.tue.nl / OOCSI-things/team-2**. Libraries: OOCSI 1.6.0, ArduinoJson 7.x, ESP32 Arduino core 3.x.

| Wire | ESP32-S3 connection |
| --- | --- |
| Servo 1 signal (orange/yellow) | GPIO4 |
| Servo 2 signal (orange/yellow) | GPIO5 |
| Both servo ground wires (brown/black) | GND |
| Both servo power wires (red) | Board 5V/VBUS, only after checking the actual board's USB power path |

Use the GPIO numbers printed on the board. Do not use 3V3 or a GPIO to power a servo. USB supplies the motors through the board's 5V rail; the ESP only generates their signals. Two unloaded servos may work, but this board's USB path and the loaded door have not been tested. If it resets or the motors stall/jitter under load, software cannot supply more current. See [Arduino's servo power guidance](https://support.arduino.cc/hc/en-us/articles/360017053760-Troubleshoot-servo-motors) and the [official S3 development-board guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html). The clone in the photograph may differ.

Both servos move together: **90 degrees locked, 0 degrees unlocked**, one degree every 50 ms, matching the supplied Uno sketch. Change `LOCKED_ANGLE` and `UNLOCKED_ANGLE` per servo if needed. The LEDC 50 Hz, 14-bit signals preserve Servo.h's default 544–2400 microsecond angle mapping. Check endpoints with the mechanism detached before using the full sweep. The first command enables pulses; there is no startup sweep.

## Heist and UI

- Two increasing, fresh heartbeats from the crew controller are required for automatic movement. Arming locks; completing Camera, Skidule, Morse and Laser unlocks at the escape phase. The shared clock continues until safe return.
- Individual practice results do not open the vault. A stale/conflicting controller pauses automatic commands. Faults, reset or connection loss do not force it closed. After automatic unlock, a puzzle reset in the same round cannot close it; prepare the door before arming a new round.
- The hacker screen's **Vault door** panel shows ESP status, manual/automatic mode, commanded angles and request acknowledgements. Its presenter buttons can override the latch. Choose **Automatic** afterwards to follow the heist again.
- Home → **Test your module** → **Vault door** provides explicit test unlock/lock/Automatic buttons. They target the selected fresh ESP and boot. The ESP rejects test commands while a fresh heist is armed/running or controllers conflict. Observation sends no heist heartbeat. Multiple input testers can remain connected.
- All angle/motion readings describe generated commands. `servo_confirmed: false` means there is no position sensor; a successful acknowledgement does not prove the door moved.

USB Serial Monitor at 115200 accepts **U** (manual unlock), **L** (manual lock), **A** (automatic), **S** (status). U/L also work without Wi-Fi credentials. Normal operation does not need Serial Monitor. Automatic retains the current controller lease and waits for a valid heist command if no controller is available.

## Upload and checks

1. Verify the board is ESP32-S3, not the XIAO C6 used by other modules. The photograph appears to show N16R8: confirm the marking before selecting 16 MB flash / 8 MB OPI PSRAM.
2. Open the `.ino` with all headers in the same folder; fill Wi-Fi locally. Compile for **ESP32S3 Dev Module** with an ESP32 core 3.x installation. The checked build used core 3.3.11, USB CDC on boot, 16 MB flash, OPI PSRAM.
3. Identify the board/port before upload. With horns/mechanism clear, test U/L or the Vault test page. End in Automatic. Check motion and actual lock direction before fitting the door.
4. Test arming, four-module completion or deliberate presenter passes, escape, new-round locking and a closed Serial Monitor. Check motor load, USB stability and endpoints on the real kit.

This is a presentation prop on public OOCSI, not an access-control lock. Compiled successfully; no board was flashed or moved here. The [Uno bridge](VAULT_BRIDGE.md) remains an alternative if you keep the existing Uno power/wiring.
