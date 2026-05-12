"""Minimal workflow engine for multi-extension readiness."""

from autohom_bridge.orchestration.extension_registry import EXTENSION_CAPABILITIES
from autohom_bridge.orchestration.workflow_models import make_workflow


class WorkflowEngine:
    def __init__(self, workflow_store):
        self.workflow_store = workflow_store

    def create_workflow(self, workflow_id, trace_id, name="autohom-workflow"):
        workflow = make_workflow(workflow_id, trace_id, name=name)
        return self.workflow_store.put(workflow)

    def available_extensions(self):
        return EXTENSION_CAPABILITIES
