"""Basic validation script for observability artifacts."""

import json
import os
import sys
import zipfile


def main():
    base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".autohom-observability")
    latest_events = os.path.join(base_dir, "latest", "events.jsonl")
    if not os.path.exists(latest_events):
        latest_events = ""
        run_root = os.path.join(base_dir, "runs")
        if os.path.isdir(run_root):
            for root, _, files in os.walk(run_root):
                if "events.jsonl" in files:
                    latest_events = os.path.join(root, "events.jsonl")
                    break
    if not latest_events or not os.path.exists(latest_events):
        print("No events.jsonl found in latest or runs directories.")
        return 1

    with open(latest_events, "r", encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, start=1):
            if not line.strip():
                continue
            event = json.loads(line)
            for field in ("schemaVersion", "eventId", "eventName", "component", "runId"):
                if not event.get(field):
                    raise ValueError(f"Missing {field} on line {line_no}")

    zip_paths = []
    run_root = os.path.join(base_dir, "runs")
    if os.path.isdir(run_root):
        for root, _, files in os.walk(run_root):
            for filename in files:
                if filename.endswith(".zip"):
                    zip_paths.append(os.path.join(root, filename))
    if zip_paths:
        with zipfile.ZipFile(zip_paths[-1], "r") as zf:
            names = set(zf.namelist())
            required = {"summary.md", "ai-debug-prompt.md", "timeline.json", "events.jsonl"}
            missing = required - names
            if missing:
                raise ValueError(f"Missing files in diagnostic zip: {sorted(missing)}")

    print("Observability artifacts look valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
