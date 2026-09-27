# Hardware/software interface

USB: newline-delimited JSON, serial monitor setting 115200, 5 Hz output. Firmware reads radar UART at 256000 baud. X/Y are millimetres from the radar origin; +Y points forward. Verify X polarity by walking a known point.

Hardware → software: radar_seq, radar_boot, radar_valid, radar_x_mm, radar_y_mm; USB diagnostic messages also include all target slots. Treat invalid, stale or ambiguous observations as unsuitable for game decisions. No real sample recordings are included.

Software → hardware: heartbeat with toktik_session, toktik_beat, toktik_state and toktik_guide (left/right/forward/back/stop). Guidance expires after one second; missing heartbeat faults after two seconds. Check the actual firmware/parser source for complete fields.

Default optional OOCSI channel: OOCSI-things/team-2-bank-heist on oocsi.id.tue.nl. Both sides must use the same channel. The software is game authority; do not run competing authorities on one channel. Public networking is opt-in and is not enabled by cloning or running tests.

LED prototype: left blue one pulse, right blue two, forward green three, back green four; stop steady red; amber fault indication. Physical cue interpretation remains to be tested with player pairs.
