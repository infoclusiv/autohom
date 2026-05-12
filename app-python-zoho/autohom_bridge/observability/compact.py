"""Compaction helpers for exports."""


def compact_events(events, max_events=500):
    events = list(events or [])
    return events[-max_events:]
