# Maze generation and difficulty

The default is **Hard**, a 4 × 3 maze in the standard 3 m × 2 m field. Normal requests 3 × 3; Expert requests up to 5 × 4. Dimensions are capped by the actual field: cell pitch must be at least 600 mm, leaving at least 400 mm of clear passage between 200 mm red walls. Thus Expert is 5 × 3 in the default field; a deeper field is needed for four rows. These are geometric limits, not measured radar accuracy guarantees.

Each candidate is a randomized depth-first spanning tree of adjacent rooms. Open edges become passages; closed edges become rectangular red walls. Every room is connected, and there is exactly one route through the passages from START to VAULT. The generator samples candidates and prefers routes with a required detour and off-route dead ends. It randomly selects among qualifying candidates rather than always choosing the single longest route. A deterministic winding fallback handles degenerate random input. It retries repeated layouts between rounds.

START and VAULT are inset within opposite corner rooms, so changing difficulty also changes their marked regions and invalidates the setup check. The maze remains fixed for the round. The UI shows walls, not the solution path.

## Wall penalties

Unlike the earlier solid-cell layout, maze walls do not require a 0.6-second dwell. A point inside a wall's core or a line segment crossing that core between two fresh valid samples causes an anomaly. This prevents stepping through a wall between 5 Hz radar updates. Each edge has 35 mm tolerance; the generator overlaps wall ends and extends boundary walls to avoid unpenalized corner/edge gaps.

One anomaly is counted per encounter; stay clear of walls for one second to rearm. Existing 5-second penalties and 3-anomaly lockdown remain configurable. Walls are penalty zones, not physical barriers: taking a deliberate shortcut can still cost an anomaly. Invalid or stale data never supplies a crossing segment.

Before live use, walk-test the narrower passages and confirm position noise is acceptable. Use Normal or enlarge the field if the measured tracking error is too large. No physical accuracy is inferred from the synthetic tests.
