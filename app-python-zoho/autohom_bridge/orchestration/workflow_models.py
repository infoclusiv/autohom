"""Workflow model helpers."""

import time


def make_workflow(workflow_id, trace_id, name="autohom-workflow"):
    return {
        "workflowId": workflow_id,
        "traceId": trace_id,
        "name": name,
        "status": "running",
        "startedAt": time.time(),
        "completedAt": None,
        "steps": [],
    }
