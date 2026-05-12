"""Helpers for workflow traces."""

import time


def add_workflow_step(workflow_state, name, component, status="pending", **payload):
    step = {
        "stepId": f"step_{len(workflow_state.get('steps', [])) + 1:03d}",
        "name": name,
        "component": component,
        "status": status,
        "startedAt": time.time(),
        "completedAt": None,
        "input": payload.get("input", {}),
        "output": payload.get("output", {}),
    }
    workflow_state.setdefault("steps", []).append(step)
    return step
