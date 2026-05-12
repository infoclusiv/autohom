"""Diagnostic export builder."""

import json
import os
import time
import zipfile

from autohom_bridge.observability.compact import compact_events
from autohom_bridge.observability.contracts import COMPONENT_CONTRACTS, MESSAGE_CONTRACTS
from autohom_bridge.observability.redaction import redact_dict


class DiagnosticExporter:
    def __init__(self, observability_service, bridge_session=None):
        self.observability = observability_service
        self.bridge_session = bridge_session

    def export(self, scope="latest", workflow_id=None, max_events=500, include_browser_events=True, include_debug_prompt=True, redaction_level="standard"):
        run_id = self.observability.run_id
        package_id = f"pkg_{int(time.time())}"
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        workflow = None
        if workflow_id:
            workflow = self.observability.context.active_workflows.get(workflow_id)

        bridge_state = self.bridge_session.get_bridge_state() if self.bridge_session else {}
        snapshots = self.observability.snapshot_state(bridge_state=bridge_state)
        events = compact_events(self.observability.recent_events(max_events), max_events=max_events)
        errors = [event for event in events if event.get("level") in {"error", "critical"}]
        warnings = [event for event in events if event.get("level") == "warn"]
        last_event = events[-1] if events else {}
        failure_event = errors[0] if errors else (warnings[0] if warnings else last_event)

        summary = self._build_summary(workflow, failure_event, bridge_state, len(events))
        debug_prompt = self._build_debug_prompt()
        diagnostic_index = {
            "packageVersion": "1.0",
            "project": "autohom",
            "runId": run_id,
            "workflowId": workflow_id or "",
            "traceId": (workflow or {}).get("traceId", ""),
            "result": "failed" if failure_event and failure_event.get("level") in {"warn", "error", "critical"} else "succeeded",
            "mainFailureEventId": failure_event.get("eventId", ""),
            "firstErrorEventId": errors[0].get("eventId", "") if errors else "",
            "lastGoodEventId": last_event.get("eventId", ""),
            "suspectedComponent": failure_event.get("component", ""),
            "suspectedContract": failure_event.get("eventName", ""),
            "filesToInspectFirst": self._files_for_component(failure_event.get("component", "")),
            "includedFiles": {
                "timeline": "timeline.json",
                "events": "events.jsonl",
                "errors": "errors.json",
            },
        }
        timeline = [
            {
                "eventId": event.get("eventId"),
                "timestamp": event.get("timestamp"),
                "eventName": event.get("eventName"),
                "component": event.get("component"),
                "status": event.get("status"),
                "message": event.get("message"),
            }
            for event in events
        ]

        package_dir = os.path.join(self.observability.sink.run_dir, package_id)
        os.makedirs(package_dir, exist_ok=True)
        files = {
            "summary.md": summary,
            "ai-debug-prompt.md": debug_prompt if include_debug_prompt else "",
            "diagnostic-index.json": json.dumps(diagnostic_index, ensure_ascii=False, indent=2),
            "timeline.json": json.dumps(timeline, ensure_ascii=False, indent=2),
            "events.jsonl": "\n".join(json.dumps(event, ensure_ascii=False) for event in events) + ("\n" if events else ""),
            "errors.json": json.dumps(errors, ensure_ascii=False, indent=2),
            "warnings.json": json.dumps(warnings, ensure_ascii=False, indent=2),
            "state-snapshot.json": json.dumps(snapshots["state-snapshot.json"], ensure_ascii=False, indent=2),
            "bridge-state.json": json.dumps(redact_dict(bridge_state), ensure_ascii=False, indent=2),
            "workflow-state.json": json.dumps(snapshots["workflow-state.json"], ensure_ascii=False, indent=2),
            "browser-snapshot.json": json.dumps({"recentBrowserEvents": self.observability.sink.recent_browser_events.recent(100) if include_browser_events else []}, ensure_ascii=False, indent=2),
            "component-contracts.json": json.dumps(COMPONENT_CONTRACTS, ensure_ascii=False, indent=2),
            "message-contracts.json": json.dumps(MESSAGE_CONTRACTS, ensure_ascii=False, indent=2),
            "http-routes.json": json.dumps({"routes": ["/api/pdfs", "/api/config", "/api/bridge", "/api/observability/*"]}, ensure_ascii=False, indent=2),
            "websocket-messages.json": json.dumps(MESSAGE_CONTRACTS, ensure_ascii=False, indent=2),
            "network-summary.json": json.dumps({"scope": scope, "redactionLevel": redaction_level}, ensure_ascii=False, indent=2),
            "selector-checkpoints.json": json.dumps({"events": [event for event in events if event.get("eventName") == "browser.selector.missing"]}, ensure_ascii=False, indent=2),
            "repo-context.json": json.dumps({"filesToInspectFirst": diagnostic_index["filesToInspectFirst"]}, ensure_ascii=False, indent=2),
        }

        for filename, content in files.items():
            with open(os.path.join(package_dir, filename), "w", encoding="utf-8") as fh:
                fh.write(content)

        zip_name = f"autohom-diagnostic_{timestamp}_{workflow_id or run_id}.zip"
        zip_path = os.path.join(self.observability.sink.run_dir, zip_name)
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for filename in files:
                zf.write(os.path.join(package_dir, filename), arcname=filename)

        self.observability.generated_packages[package_id] = {"packageId": package_id, "zipPath": zip_path, "zipName": zip_name}
        return {
            "packageId": package_id,
            "packagePath": zip_path,
            "packageName": zip_name,
            "downloadPath": f"/api/observability/export/{package_id}",
        }

    def get_package(self, package_id):
        return self.observability.generated_packages.get(package_id)

    def _files_for_component(self, component):
        mapping = {
            "python.bootstrap": ["app-python-zoho/autohom_bridge/bootstrap.py"],
            "python.http": ["app-python-zoho/autohom_bridge/api/routes.py"],
            "python.ws": ["app-python-zoho/autohom_bridge/bridge/session.py"],
            "python.state": ["app-python-zoho/autohom_bridge/storage/state_manager.py"],
            "extension.bridge": ["zoho-ilovepdf-extension/ilovepdf-background/bridge.js"],
            "extension.runtime": ["zoho-ilovepdf-extension/ilovepdf-background/runtime.js"],
            "sidepanel.ui": ["zoho-ilovepdf-extension/sidepanel/bootstrap.js"],
        }
        return mapping.get(component, [])

    def _build_summary(self, workflow, failure_event, bridge_state, event_count):
        return f"""# Autohom Diagnostic Summary

## Result
{"Failed" if failure_event and failure_event.get("level") in {"warn", "error", "critical"} else "Succeeded / Incomplete"}

## Main failure
Event: {failure_event.get("eventName", "")}
Component: {failure_event.get("component", "")}
Operation: {failure_event.get("operation", "")}
Error: {(failure_event.get("error") or {}).get("message", "") if failure_event else ""}
Expected: {json.dumps((failure_event or {}).get("expected", {}), ensure_ascii=False)}
Actual: {json.dumps((failure_event or {}).get("actual", {}), ensure_ascii=False)}

## Timeline summary
1. Run `{self.observability.run_id}` captured {event_count} recent events.
2. Bridge status at export: `{bridge_state.get("status", "")}`.
3. Active workflow: `{(workflow or {}).get("workflowId", "")}`.

## Active workflow
workflowId: {(workflow or {}).get("workflowId", "")}
traceId: {(workflow or {}).get("traceId", "")}
currentStep: {((workflow or {}).get("steps") or [{}])[-1].get("name", "") if workflow else ""}

## Components involved
- python.bootstrap
- python.http
- python.ws
- python.state
- extension.bridge
- extension.runtime
- sidepanel.ui

## Evidence priority for AI
1. Inspect this event first: {failure_event.get("eventId", "")}
2. Inspect this component first: {failure_event.get("component", "")}
3. Inspect this contract: {failure_event.get("eventName", "")}
4. Inspect browser snapshot: browser-snapshot.json
5. Inspect state transition: state-snapshot.json
"""

    def _build_debug_prompt(self):
        return """# AI Debug Prompt

You are debugging the `autohom` project.

Use the diagnostic package as the source of truth.

Start by reading:
1. summary.md
2. diagnostic-index.json
3. timeline.json
4. errors.json
5. component-contracts.json

Do not guess. For every conclusion, reference the eventId, component, and timestamp.

Tasks:
1. Identify the most likely root cause.
2. Identify the exact component and file to inspect.
3. Explain expected vs actual behavior.
4. Propose the smallest safe code change.
5. Propose observability improvements if evidence is insufficient.
"""
