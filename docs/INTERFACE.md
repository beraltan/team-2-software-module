# OOCSI Thing / camera message contract

The browser is the game authority. Radar camera → OOCSI → browser → OOCSI → camera LEDs / other puzzles. Server: `wss://oocsi.id.tue.nl/ws` for browsers; existing firmware uses `oocsi.id.tue.nl:4444`. The course team selector maps Team 7 to `OOCSI-things/team-7`. It must match on all modules. Use a unique channel and one controlling browser per group.

## Camera → browser (5 Hz)

OOCSI browser callbacks provide `{sender, recipient, data}`. These fields belong inside `data`:

```json
{"type":"radar","radar_boot":"8fa3c021","radar_seq":42,"radar_valid":true,"radar_x_mm":-900,"radar_y_mm":1800,"guidance_supported":true}
```

| Field | Type / meaning |
| --- | --- |
| `radar_boot` | String; changes whenever the camera restarts |
| `radar_seq` | Nonnegative safe integer; strictly increases within a boot |
| `radar_valid` | Boolean; true only for one unambiguous tracked target |
| `radar_x_mm`, `radar_y_mm` | Finite numbers, Cartesian millimetres from the radar |
| `guidance_supported` | Boolean; true when the firmware implements directional LEDs |
| `radar_frame`, `radar_device_ms`, `radar_target_count` | Optional device diagnostics |

+Y points away from the camera; verify X polarity physically. Mirror X is applied before gameplay. The user selects the sender; other cameras can be discovered but cannot move the player. Old/duplicate sequences are rejected. Samples older than 450 ms cannot trigger gameplay. Tracking loss/invalidity lasting one second faults a running attempt. A changed boot faults an active round. The firmware's selection envelope is X ±1500 / Y 1500–4500 mm even if the configured field is smaller.

## Browser → channel (5 Hz while connected, unless conflicted)

```json
{"toktik_session":"4f0c9d53-a1e2-4abc-8abc-123456789abc","toktik_beat":25,"toktik_state":"running","toktik_time_s":172.5,"toktik_suspicion":0.2,"toktik_penalties":1,"toktik_ready":true,"toktik_guide":"left","toktik_round_id":"a123456789","toktik_camera":"team2_camera_8fa3c021"}
```

| Field | Type / meaning |
| --- | --- |
| `toktik_session` | UUID string, new for each page load |
| `toktik_beat` | Increasing integer heartbeat counter |
| `toktik_state` | `idle`, `running`, `won`, `lost`, `fault` |
| `toktik_time_s` | Number of seconds remaining, including penalties |
| `toktik_suspicion` | Number 0…1; overlap indicator |
| `toktik_penalties` | Integer anomaly count |
| `toktik_ready` | Boolean; room setup checked |
| `toktik_guide` | `left`, `right`, `forward`, `back`, `stop` |
| `toktik_round_id` | String for deduplicating results; null before a round |
| `toktik_camera` | Selected OOCSI sender name |
| `toktik_play`, `toktik_start`, `toktik_goal` | `[left,right,near,far]` rectangle in mm |
| `toktik_zones` | Array of restricted rectangles |
| `toktik_mirror_x` | Boolean |
| `toktik_max_anomalies` | Integer lockdown threshold |
| `toktik_tick`, `toktik_toggle` | Elapsed whole seconds / running boolean |

Browser guidance expires after one second without renewal. Invalid tracking produces STOP. The current firmware faults on a missing heartbeat after two seconds; it does not independently implement the browser's one-second guidance renewal timeout. OOCSI radar messages do not report the observed LED state; the UI does not claim optical confirmation.

The controller listens for three seconds on connection. Another session's heartbeat stops it from publishing and invalidates a running round. Close extra authorities and reset after three quiet seconds. The stock Things client retries connection automatically, but a disconnected running attempt faults and never auto-resumes. Heartbeats are sent only while connected. No remote start/reset/abort is accepted by the new browser authority; the legacy Things companion start command belongs to the old service only.


## Course Things API

The single-file module calls `oocsiThings.register('Bank Heist', 'toktik', ['x_mm','y_mm','valid'], outputs)` from `thing()`. Inputs use `data()` and `link('radar', ...)`; game decisions still require complete, sequenced radar messages from the selected sender. Shared outputs are `state`, `time_s`, `suspicion`, `penalties`, `guide`, `round_id`, `tick` and `toggle`. Their wire names have the `toktik_` prefix. A coherent full heartbeat remains available for firmware.

In another course Thing, register your own handle, define local variables, then link them:

```js
function thing() {
  oocsiThings.register('Next puzzle', 'next-puzzle', ['heist_state','heist_round'], []);
  const state = oocsiThings.data('heist_state');
  const round = oocsiThings.data('heist_round');
  oocsiThings.link('toktik', 'state', 'heist_state');
  oocsiThings.link('toktik', 'round_id', 'heist_round');
  // Values are read using state() and round().
  // For a one-time trigger, use atomic messages to avoid mixing separate updates:
  const seen = new Set();
  oocsiThings.subscribe(({data}) => {
    const key = data.toktik_session + ':' + data.toktik_round_id;
    if (data.toktik_session && data.toktik_state === 'won' && data.toktik_round_id && !seen.has(key)) {
      seen.add(key);
      document.getElementById('result').textContent = 'Next puzzle ready';
    }
  });
}
```

Both Things must choose the same team. Include a `result` element in the listener page. The legacy `team-2-bank-heist` channel is not the same as the standard `team-2` space.

## Example: a plain OOCSI listener

Using the included OOCSI browser library in a separate *listener* page (it must not send `toktik_*` heartbeats):

```html
<script src="./app/vendor/oocsi-web.js"></script>
<button id="connect">Connect listener</button>
<p id="result">Waiting</p>
<script>
const seen = new Set();
document.getElementById('connect').onclick = function () {
  this.disabled = true;
  OOCSI.connect('wss://oocsi.id.tue.nl/ws', 'puzzle_listener_########');
  OOCSI.subscribe('OOCSI-things/team-7', ({data}) => {
    const key = data.toktik_session + ':' + data.toktik_round_id;
    if (data.toktik_state === 'won' && data.toktik_round_id && !seen.has(key)) {
      seen.add(key);
      document.getElementById('result').textContent = 'Vault reached — next puzzle ready';
    }
  });
};
</script>
```

The example deduplicates only for that page lifetime. For physical actuators, add your own freshness, authority/session selection and persisted deduplication as needed. Public OOCSI data is unauthenticated; a channel name is not access control.

## Optional USB

115200 baud, newline-delimited JSON. Camera samples use the fields above and may include `targets`. Heartbeats add `"command":"heartbeat"`. First-time configuration sends `{"command":"wifi_config","ssid":"…","password":"…","channel":"…","enabled":true}` directly to the camera; it stores credentials and restarts. Never put real credentials in documentation or commits. See [USB tools](USB.md).
