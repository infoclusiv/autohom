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

    try {
      _ws = new WebSocket(CONFIG_ILOVEPDF.BRIDGE_URL);
    } catch (e) {
      _log(`Connection error: ${e.message}`);
      _scheduleReconnect();
      return;
    }

    _ws.onopen = () => {
      _log("WebSocket opened, sending EXTENSION_CONNECTED...");
      _connected = false;
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

      if (action === "PING") {
        _log("Received PING, sending PONG...");
        _send({
          action: "PONG",
          requestId: data.requestId || "",
          replyTo: data.requestId || "",
          ..._buildIdentityPayload(),
        });
        _connected = true;
        _notifyConnectionStatus(true);
        return;
      }

      // Handle business messages from Python
      if (action === "CONVERT_PDF") {
        _log(`Received CONVERT_PDF: ${data.filename}`);
        ILovePDFRuntime.queueConversion({
          pdfId: data.pdfId,
          filename: data.filename,
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
      _notifyConnectionStatus(false);
      _scheduleReconnect();
    };

    _ws.onerror = () => {
      _log("WebSocket error");
      _connected = false;
      _notifyConnectionStatus(false);
    };
  }

  function _send(payload) {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      try {
        _ws.send(JSON.stringify(payload));
        return true;
      } catch (e) {
        _log(`Send error: ${e.message}`);
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
    _reconnectTimer = setTimeout(() => {
      _reconnectTimer = null;
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
