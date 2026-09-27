import unittest
from engine import Game


class Rules(unittest.TestCase):
    def setUp(self):
        self.g = Game(0, dict(play=[-1500,1500,1500,4500],start=[-1200,-600,1500,2100],goal=[600,1200,3800,4300],patrol_x=0,layout_mode='patrol',overlap_s=2,cooldown_s=2,max_anomalies=100))
        self.seq = 0

    def sample(self, t, x=-900, y=1800, valid=True, boot='test'):
        self.seq += 1
        self.g.ingest(dict(radar_seq=self.seq, radar_boot=boot, radar_valid=valid, radar_x_mm=x, radar_y_mm=y), t)
        self.g.tick(t)

    def start(self):
        self.sample(0)
        self.g.setup_checked = True
        self.g.start(0)

    def test_start_gate(self):
        with self.assertRaises(ValueError): self.g.start(0)
        self.g.setup_checked = True
        self.sample(0, 0, 3000)
        with self.assertRaises(ValueError): self.g.start(0)

    def test_single_penalty_and_rearm(self):
        self.start()
        for i in range(1, 61): self.sample(i/10, 0, 2800)
        self.assertEqual(self.g.penalties, 1)
        for i in range(61, 85): self.sample(i/10, -900, 2800)
        for i in range(85, 110): self.sample(i/10, 0, 2800)
        self.assertEqual(self.g.penalties, 2)

    def test_brief_invalid_cannot_win_or_pause(self):
        self.start()
        self.sample(.2, 900, 4000, False)
        self.g.tick(.8)
        self.assertEqual(self.g.state, 'running')
        self.assertAlmostEqual(self.g.remaining, 179.2)
        self.sample(.9)
        self.assertEqual(self.g.state, 'running')

    def test_invalid_fault_does_not_resume(self):
        self.start()
        for t in [.1, .4, .7, 1.2]: self.sample(t, valid=False)
        self.assertEqual(self.g.state, 'fault')
        self.sample(1.3, 900, 4000)
        self.assertEqual(self.g.state, 'fault')
        with self.assertRaises(ValueError): self.g.start(1.4)

    def test_stale_and_duplicate_frames(self):
        self.start()
        self.g.ingest(dict(radar_seq=1, radar_boot='test', radar_valid=True, radar_x_mm=900, radar_y_mm=4000), .9)
        self.g.tick(1.01)
        self.assertEqual(self.g.state, 'fault')

    def test_restart_fault(self):
        self.start()
        self.sample(.2, boot='new')
        self.assertEqual(self.g.state, 'fault')

    def test_valid_goal_wins(self):
        self.start()
        self.sample(.2, 900, 4000)
        self.assertEqual(self.g.state, 'won')

    def test_time_zero_and_reset(self):
        self.start()
        self.g.remaining = .1
        self.sample(.2)
        self.assertEqual(self.g.state, 'lost')
        self.assertEqual(self.g.remaining, 0)
        self.g.reset(.3)
        self.assertEqual(self.g.remaining, 180)
        self.assertFalse(self.g.setup_checked)

    def test_tripwire_duplicate(self):
        self.start()
        self.assertTrue(self.g.tripwire('A', 1, .1))
        self.assertFalse(self.g.tripwire('A', 1, .2))
        self.assertEqual(self.g.penalties, 1)

    def test_invalid_breaks_continuous_overlap(self):
        self.start()
        for i in range(1, 19): self.sample(i/10, 0, 2800)
        self.sample(1.9, valid=False)
        for i in range(20, 35): self.sample(i/10, 0, 2800)
        self.assertEqual(self.g.penalties, 0)

    def test_late_recovery_cannot_hide_outage(self):
        self.start()
        self.sample(1.1, 900, 4000)
        self.assertEqual(self.g.state, 'fault')

    def test_reset_blocked_during_play(self):
        self.start()
        with self.assertRaises(ValueError): self.g.reset(.1)

    def test_safe_area_does_not_reset_time(self):
        self.start()
        for i in range(1,21): self.sample(i/10)
        self.assertAlmostEqual(self.g.remaining,178)

    def test_nonfinite_coordinate_invalid(self):
        self.start()
        self.sample(.1,float('nan'),1800)
        self.assertFalse(self.g.fresh(.1))

    def test_patrol_uses_both_axes(self):
        self.start()
        for i in range(1,40): self.sample(i/10,0,1800)
        self.assertEqual(self.g.penalties,0)


if __name__ == '__main__': unittest.main()
