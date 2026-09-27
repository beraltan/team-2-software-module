"""Concept 1 rules. Times are monotonic seconds, coordinates are sensor-relative mm."""
import math
import uuid

DEFAULTS = dict(round_s=180.0, penalty_s=5.0, overlap_s=2.0, cooldown_s=2.0,
                fault_s=1.0, sample_fresh_s=0.45, patrol_period_s=16.0,
                play=[-1500, 1500, 1500, 4500], start=[-1200, -600, 1500, 2100],
                goal=[600, 1200, 3700, 4300], zone_width=600, zone_y=[2400, 3400],
                patrol_x=1200, boundary_margin_mm=0)


def inside(x, y, bounds, margin=0):
    left, right, near, far = bounds
    return left + margin <= x <= right - margin and near + margin <= y <= far - margin


class Game:
    def __init__(self, now, config=None):
        self.cfg = {**DEFAULTS, **(config or {})}
        self.state = 'idle'
        self.remaining = self.cfg['round_s']
        self.suspicion = 0.0
        self.penalties = 0
        self.events = []
        self.last_tick = now
        self.started = None
        self.last_sample = None
        self.sample_key = None
        self.boot = None
        self.seq = -1
        self.point = None
        self.targets = []
        self.bad_since = None
        self.overlap_since = None
        self.out_since = None
        self.armed = True
        self.setup_checked = False
        self.round_id = None
        self.reason = ''
        self.tripwire_seen = set()
        self.last_beat = 0

    def event(self, name, now, **data):
        self.events.append(dict(event=name, at=round(now, 3), round_id=self.round_id, **data))
        self.events = self.events[-1000:]

    def ingest(self, data, now):
        # Evaluate elapsed time BEFORE accepting a recovery packet. A late packet
        # must not conceal a one-second outage or a suspended service process.
        self.tick(now)
        seq, boot = data.get('radar_seq'), str(data.get('radar_boot', 'legacy'))
        if not isinstance(seq, int) or isinstance(seq, bool) or seq < 0:
            return False
        if boot == self.boot and seq <= self.seq:
            return False
        if self.boot is not None and boot != self.boot and self.state == 'running':
            self.finish('fault', 'Radar restarted during the round', now)
        self.boot, self.seq, self.last_sample = boot, seq, now
        self.targets = data.get('targets', [])
        x, y = data.get('radar_x_mm'), data.get('radar_y_mm')
        valid = data.get('radar_valid') is True and all(
            isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in (x, y))
        valid = valid and inside(x, y, self.cfg['play'])
        self.point = dict(x=x, y=y) if valid else None
        if not valid:
            if self.bad_since is None:
                self.bad_since = now
            self.overlap_since = None
        else:
            self.bad_since = None
        return True

    def fresh(self, now):
        return self.point is not None and self.last_sample is not None and now - self.last_sample <= self.cfg['sample_fresh_s']

    def zone(self, now):
        elapsed = max(0, now - self.started) if self.started is not None else 0
        # Start at x=0, patrol right, then left with a smooth sinusoid.
        centre = self.cfg['patrol_x'] * math.sin(2 * math.pi * elapsed / self.cfg['patrol_period_s'])
        return [centre - self.cfg['zone_width']/2, centre + self.cfg['zone_width']/2, *self.cfg['zone_y']]

    def start(self, now):
        if self.state != 'idle':
            raise ValueError('Only the facilitator can reset a finished or faulted attempt.')
        if not self.setup_checked:
            raise ValueError('Facilitator must check the floor layout and enable the round first.')
        if not self.fresh(now) or not inside(self.point['x'], self.point['y'], self.cfg['start']):
            raise ValueError('Exactly one tracked infiltrator must stand in the marked start region.')
        self.state, self.started, self.last_tick = 'running', now, now
        self.round_id = uuid.uuid4().hex[:10]
        self.event('start', now)

    def finish(self, state, reason, now):
        self.state, self.reason = state, reason
        self.event(state, now, reason=reason, remaining_s=round(self.remaining, 3), penalties=self.penalties)

    def reset(self, now):
        if self.state == 'running':
            raise ValueError('Abort the active attempt before resetting.')
        self.event('reset', now)
        self.state, self.remaining, self.suspicion = 'idle', self.cfg['round_s'], 0.0
        self.started, self.round_id, self.reason = None, None, ''
        self.penalties, self.armed, self.overlap_since, self.out_since = 0, True, None, None
        self.setup_checked = False
        self.last_tick = now

    def tick(self, now):
        dt, self.last_tick = max(0, now-self.last_tick), now
        if self.state != 'running':
            return
        self.remaining = max(0, self.remaining - dt)
        stale = self.last_sample is None or now - self.last_sample >= self.cfg['fault_s']
        bad = self.bad_since is not None and now - self.bad_since >= self.cfg['fault_s']
        if stale or bad:
            self.finish('fault', 'Tracking missing, stale or ambiguous for one second', now)
            return
        if self.remaining <= 0:
            self.finish('lost', 'Time ran out', now)
            return
        if not self.fresh(now):
            self.overlap_since = None
            self.out_since = None
            return
        x, y = self.point['x'], self.point['y']
        overlap = inside(x, y, self.zone(now))
        if overlap:
            self.out_since = None
            if self.overlap_since is None:
                self.overlap_since = now
            self.suspicion = min(1, self.suspicion + dt / self.cfg['overlap_s'])
            if self.armed and now-self.overlap_since >= self.cfg['overlap_s']:
                self.remaining = max(0, self.remaining-self.cfg['penalty_s'])
                self.penalties += 1
                self.armed = False
                self.event('penalty', now, reason='surveillance overlap', seconds=self.cfg['penalty_s'])
        else:
            self.overlap_since = None
            self.suspicion = max(0, self.suspicion-dt/self.cfg['overlap_s'])
            if self.out_since is None:
                self.out_since = now
            if now-self.out_since >= self.cfg['cooldown_s']:
                self.armed = True
        if self.remaining <= 0:
            self.finish('lost', 'Time ran out after a penalty', now)
        elif inside(x, y, self.cfg['goal'], self.cfg['boundary_margin_mm']):
            self.finish('won', 'Vault reached', now)

    def tripwire(self, beam, event_id, now):
        # Extension hook only. Caller must validate source/session before using it.
        key = (str(beam), str(event_id))
        if self.state != 'running' or key in self.tripwire_seen:
            return False
        self.tripwire_seen.add(key)
        self.remaining = max(0, self.remaining-self.cfg['penalty_s'])
        self.penalties += 1
        self.event('penalty', now, reason='tripwire', beam=str(beam), seconds=self.cfg['penalty_s'])
        if self.remaining == 0:
            self.finish('lost', 'Time ran out after tripwire', now)
        return True

    def snapshot(self, now):
        return dict(state=self.state, remaining_s=round(self.remaining, 3), suspicion=round(self.suspicion, 3),
                    penalties=self.penalties, valid=self.fresh(now), point=self.point if self.fresh(now) else None,
                    zone=self.zone(now), config=self.cfg, reason=self.reason, round_id=self.round_id,
                    setup_checked=self.setup_checked, sample_age_s=None if self.last_sample is None else now-self.last_sample,
                    events=self.events[-12:])
