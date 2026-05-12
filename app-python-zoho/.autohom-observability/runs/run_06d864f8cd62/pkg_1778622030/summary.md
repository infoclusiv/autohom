# Autohom Diagnostic Summary

## Result
Failed

## Main failure
Event: workflow.step.failed
Component: extension.runtime
Operation: fake_conversion
Error: 
Expected: {"found": true}
Actual: {"found": false}

## Timeline summary
1. Run `run_06d864f8cd62` captured 4 recent events.
2. Bridge status at export: ``.
3. Active workflow: `wf_073794e1a958`.

## Active workflow
workflowId: wf_073794e1a958
traceId: tr_32b7ee2dee9b
currentStep: 

## Components involved
- python.bootstrap
- python.http
- python.ws
- python.state
- extension.bridge
- extension.runtime
- sidepanel.ui

## Evidence priority for AI
1. Inspect this event first: evt_35480b0f4a59464e
2. Inspect this component first: extension.runtime
3. Inspect this contract: workflow.step.failed
4. Inspect browser snapshot: browser-snapshot.json
5. Inspect state transition: state-snapshot.json
