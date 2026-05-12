"""Generate a sample observability run and diagnostic package."""

import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from autohom_bridge.observability.diagnostics import ObservabilityService
from autohom_bridge.observability.exporter import DiagnosticExporter


def main():
    base_dir = os.path.join(ROOT_DIR, ".autohom-observability")
    obs = ObservabilityService(base_dir=base_dir)
    workflow = obs.start_workflow("simulate_observability_flow")
    obs.emit(
        "workflow.step.started",
        component="python.bootstrap",
        operation="fake_conversion",
        workflowId=workflow["workflowId"],
        traceId=workflow["traceId"],
        status="started",
        message="Fake PDF conversion started.",
        data={"pdfId": "pdf_demo"},
    )
    obs.emit(
        "workflow.step.failed",
        component="extension.runtime",
        operation="fake_conversion",
        workflowId=workflow["workflowId"],
        traceId=workflow["traceId"],
        level="error",
        status="failed",
        message="Fake selector failure.",
        data={"selector": ".download-button"},
        actual={"found": False},
        expected={"found": True},
    )
    exporter = DiagnosticExporter(obs)
    result = exporter.export(workflow_id=workflow["workflowId"])
    print(result["packagePath"])


if __name__ == "__main__":
    main()
