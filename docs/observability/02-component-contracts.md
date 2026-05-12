# Component Contracts

## python.bootstrap

- Owner files: `autohom_bridge/bootstrap.py`
- Inputs: process startup, config constants
- Outputs: initialized state manager, WebSocket server, HTTP app
- Events: `python.startup.*`, `python.shutdown.*`
- Invariants: one `runId` per Python process startup

## python.http

- Owner files: `autohom_bridge/api/*`
- Inputs: local HTTP requests
- Outputs: JSON responses, file responses, response trace headers
- Events: `http.request.*`, `http.response.sent`, `http.handler.failed`
- Invariants: every request gets `requestId`, route summary, and duration

## python.ws

- Owner files: `autohom_bridge/bridge/session.py`
- Inputs: WebSocket handshake and business messages
- Outputs: bridge state, waiter resolution, queue commands
- Events: `ws.*`
- Accepted message types: `PING`, `PONG`, `EXTENSION_CONNECTED`, `CONVERT_PDF`, `CONVERT_PDF_ACK`, `CONVERSION_STATUS`

## python.state

- Owner files: `autohom_bridge/storage/state_manager.py`
- Inputs: folder path, scanned PDFs, status updates
- Outputs: persisted state snapshot in `state.json`
- Events: `state.*`
- Invariants: PDF ids are stable for the same file fingerprint

## python.pdf_service

- Owner files: `autohom_bridge/services/pdf_service.py`
- Inputs: local file paths and directories
- Outputs: validated PDF records and finalized downloads
- Events: `workflow.step.*`, `state.pdf.*`

## extension.service_worker

- Owner files: `background-main.js`
- Inputs: Chrome service worker lifecycle
- Outputs: imported runtime modules, reconnect scheduling
- Events: `extension.bootstrap.*`

## extension.bridge

- Owner files: `ilovepdf-background/bridge.js`
- Inputs: Python WebSocket server messages
- Outputs: ACKs, status, reconnect attempts
- Events: `extension.bridge.*`

## extension.runtime

- Owner files: `ilovepdf-background/runtime.js`
- Inputs: conversion requests and content script readiness
- Outputs: queue progress, download tracking, finalization
- Events: `extension.queue.*`, `ilovepdf.*`

## extension.tab_manager

- Owner files: `ilovepdf-background/tabManager.js`
- Inputs: target page URLs and readiness checks
- Outputs: active iLovePDF tab and content-script readiness
- Events: `extension.tab.find_or_create.started`, `extension.tab.ready`, `extension.content.ready_check.*`

## extension.download_tracker

- Owner files: `ilovepdf-background/downloadTracker.js`
- Inputs: download lifecycle events
- Outputs: correlated download confirmations
- Events: `browser.download.*`, `ilovepdf.download.*`

## extension.finalizer

- Owner files: `ilovepdf-background/finalizer.js`
- Inputs: completed download metadata
- Outputs: HTTP finalize request and final file placement
- Events: `ilovepdf.finalize.*`

## sidepanel.ui

- Owner files: `sidepanel/*`, `sidepanel.html`
- Inputs: user actions and runtime events
- Outputs: API calls, workflow actions, diagnostic export triggers
- Events: `workflow.*`, `browser.runtime.error`

## content.zoho

- Owner files: `content.js`, `background-zoho.js`
- Inputs: Zoho CRM pages and download actions
- Outputs: local mapping candidates and runtime messages

## content.ilovepdf

- Owner files: `ilovepdf/content.js`, `ilovepdf/*`
- Inputs: upload and download page DOM
- Outputs: conversion and download page actions
- Events: `browser.selector.missing`, `browser.dom.checkpoint`

## future_extension.placeholder

- Owner files: future extension package, later registry entry
- Inputs: workflow step contracts from Python orchestrator
- Outputs: step ACK, status, result, or error

## workflow.orchestrator

- Owner files: `autohom_bridge/orchestration/*`
- Inputs: workflow definitions and extension capabilities
- Outputs: step model, active workflow state, multi-extension readiness
