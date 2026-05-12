/**
 * ilovepdf-background/bridge.js — WebSocket bridge client.
 *
 * Patrón: autodipsik/background/chatgptRemoteBridge.js
 * Conecta al Python WS server en ws://localhost:8769.
 */

const ILovePDFBridge = (() => {
  let _ws = null;
  let _connected = false;
  let _reconnectTimer = null;
  const _runtimeInstanceId = ILovePDFUtils.generateUUID();
  self.ILOVEPDF_RUNTIME_INSTANCE_ID = _runtimeInstanceId;

  function _log(msg) {
    ILovePDFUtils.log("info", `[Bridge] ${msg}`);
  }

  function _buildIdentityPayload() {
    return {
      extensionId: CONFIG_ILOVEPDF.EXTENSION_ID,
      extensionType: CONFIG_ILOVEPDF.EXTENSION_TYPE,
      runtimeInstanceId: _runtimeInstanceId,
      clientId: CONFIG_ILOVEPDF.EXTENSION_ID,
      version: chrome.runtime.getManifest().version || "1.0.0",
    };
  }

  function connect() {
    if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    AutohomTelemetry.emit({
      eventName: AutohomEventNames.EXTENSION_BRIDGE_CONNECT_ATTEMPTED,
      component: 'extension.bridge',
      operation: 'connect',
      status: 'started',
    });

    try {
      _ws = new WebSocket(CONFIG_ILOVEPDF.BRIDGE_URL);
    } catch (e) {
      _log(`Connection error: ${e.message}`);
      AutohomTelemetry.emit({
        eventName: AutohomEventNames.EXTENSION_BRIDGE_ERROR,
        component: 'extension.bridge',
        operation: 'connect',
        level: 'error',
        status: 'failed',
        message: e.message,
        error: { type: e.name || 'Error', message: e.message },
      });
      _scheduleReconnect();
      return;
    }

    _ws.onopen = () => {
      _log("WebSocket opened, sending EXTENSION_CONNECTED...");
      _connected = false;
      AutohomTelemetry.emit({
        eventName: AutohomEventNames.EXTENSION_BRIDGE_OPENED,
        component: 'extension.bridge',
        operation: 'onopen',
      });
      _send({
        action: "EXTENSION_CONNECTED",
        ..._buildIdentityPayload(),
      });
    };

    _ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      const action = data.action;
      AutohomTelemetry.emit({
        eventName: AutohomEventNames.EXTENSION_BRIDGE_MESSAGE_RECEIVED,
        component: 'extension.bridge',
        operation: 'onmessage',
        data: { action, requestId: data.requestId || '', replyTo: data.replyTo || '', pdfId: data.pdfId || '' },
      });

      if (action === "PING") {
        _log("Received PING, sending PONG...");
        AutohomTelemetry.emit({
          eventName: AutohomEventNames.EXTENSION_BRIDGE_PING_RECEIVED,
          component: 'extension.bridge',
          operation: 'onmessage',
          data: { requestId: data.requestId || '' },
        });
        _send({
          action: "PONG",
          requestId: data.requestId || "",
          replyTo: data.requestId || "",
          ..._buildIdentityPayload(),
        });
        AutohomTelemetry.emit({
          eventName: AutohomEventNames.EXTENSION_BRIDGE_PONG_SENT,
          component: 'extension.bridge',
          operation: 'onmessage',
          data: { requestId: data.requestId || '' },
        });
        _connected = true;
        _notifyConnectionStatus(true);
        return;
      }

      // Handle business messages from Python
      if (action === "CONVERT_PDF") {
        _log(`Received CONVERT_PDF: ${data.filename}`);
        AutohomTelemetry.setContext({
          workflowId: data.workflowId || '',
          traceId: data.traceId || '',
        });
        ILovePDFRuntime.queueConversion({
          pdfId: data.pdfId,
          filename: data.filename,
          workflowId: data.workflowId || null,
          traceId: data.traceId || null,
        });
        // ACK back to Python
        _send({
          action: "CONVERT_PDF_ACK",
          requestId: data.requestId || "",
          replyTo: data.requestId || "",
          pdfId: data.pdfId,
          ok: true,
        });
        return;
      }
    };

    _ws.onclose = (event) => {
      _log(`WebSocket closed (code=${event.code}, reason=${event.reason})`);
      _connected = false;
      _ws = null;
      AutohomTelemetry.emit({
        eventName: AutohomEventNames.EXTENSION_BRIDGE_CLOSED,
        component: 'extension.bridge',
        operation: 'onclose',
        level: event.code === 1000 ? 'info' : 'warn',
        status: 'failed',
        data: { code: event.code, reason: event.reason || '' },
      });
      _notifyConnectionStatus(false);
      _scheduleReconnect();
    };

    _ws.onerror = () => {
      _log("WebSocket error");
      _connected = false;
      AutohomTelemetry.emit({
        eventName: AutohomEventNames.EXTENSION_BRIDGE_ERROR,
        component: 'extension.bridge',
        operation: 'onerror',
        level: 'error',
        status: 'failed',
        message: 'WebSocket error',
      });
      _notifyConnectionStatus(false);
    };
  }

  function _send(payload) {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      try {
        _ws.send(JSON.stringify(payload));
        AutohomTelemetry.emit({
          eventName: AutohomEventNames.EXTENSION_BRIDGE_MESSAGE_SENT,
          component: 'extension.bridge',
          operation: '_send',
          data: { action: payload.action, requestId: payload.requestId || '', replyTo: payload.replyTo || '', pdfId: payload.pdfId || '' },
        });
        return true;
      } catch (e) {
        _log(`Send error: ${e.message}`);
        AutohomTelemetry.emit({
          eventName: AutohomEventNames.EXTENSION_BRIDGE_SEND_FAILED,
          component: 'extension.bridge',
          operation: '_send',
          level: 'error',
          status: 'failed',
          message: e.message,
          error: { type: e.name || 'Error', message: e.message },
          data: { action: payload.action, requestId: payload.requestId || '' },
        });
      }
    }
    return false;
  }

  function sendStatus(pdfId, status, message = "") {
    _log(`Sending CONVERSION_STATUS pdfId=${pdfId} status=${status}${message ? ` message=${message}` : ""}`);
    const ok = _send({
      action: "CONVERSION_STATUS",
      pdfId,
      status,
      message,
    });
    if (!ok) {
      _log(`Failed to send CONVERSION_STATUS pdfId=${pdfId} status=${status}`);
    }
    return ok;
  }

  function _scheduleReconnect() {
    if (_reconnectTimer) return;
    AutohomTelemetry.emit({
      eventName: AutohomEventNames.EXTENSION_BRIDGE_RECONNECT_SCHEDULED,
      component: 'extension.bridge',
      operation: '_scheduleReconnect',
    });
    _reconnectTimer = setTimeout(() => {
      _reconnectTimer = null;
      AutohomTelemetry.emit({
        eventName: AutohomEventNames.EXTENSION_BRIDGE_RECONNECT_TRIGGERED,
        component: 'extension.bridge',
        operation: '_scheduleReconnect',
      });
      connect();
    }, CONFIG_ILOVEPDF.TIMING.RECONNECT_INTERVAL_MS);
  }

  function _notifyConnectionStatus(isConnected) {
    // Broadcast to side panel
    chrome.runtime.sendMessage({
      type: "ILOVEPDF_BRIDGE_STATUS",
      connected: isConnected,
    }).catch(() => {});
  }

  function disconnect() {
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    }
    if (_ws) {
      _ws.close(1000, "Extension shutdown");
      _ws = null;
    }
    _connected = false;
  }

  function isConnected() {
    return _connected && _ws && _ws.readyState === WebSocket.OPEN;
  }

  // ─── Auto-reconnect via Chrome Alarms ──────────────────────────────────

  function setupAlarmReconnect() {
    chrome.alarms.create(CONFIG_ILOVEPDF.TIMING.ALARM_RECONNECT_NAME, {
      periodInMinutes: CONFIG_ILOVEPDF.TIMING.ALARM_RECONNECT_PERIOD_MINUTES,
    });
  }

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CONFIG_ILOVEPDF.TIMING.ALARM_RECONNECT_NAME) {
      if (!isConnected()) {
        _log("Alarm reconnect triggered");
        connect();
      }
    }
  });

  return { connect, disconnect, isConnected, sendStatus, setupAlarmReconnect };
})();
