const AutohomContracts = {
  components: {
    'extension.service_worker': { ownerFiles: ['background-main.js'] },
    'extension.bridge': { ownerFiles: ['ilovepdf-background/bridge.js'] },
    'extension.runtime': { ownerFiles: ['ilovepdf-background/runtime.js'] },
    'sidepanel.ui': { ownerFiles: ['sidepanel/bootstrap.js'] },
  },
  messages: {
    PING: { expectedResponse: 'PONG' },
    CONVERT_PDF: { expectedResponse: 'CONVERT_PDF_ACK' },
    CONVERSION_STATUS: { source: 'extension.bridge', target: 'python.ws' },
    MAPPING_SAVED: {
      required: ['type', 'mapping'],
      source: 'extension.service_worker',
      target: 'sidepanel.ui',
    },
    MAPPING_AUTO_FAILED: {
      required: ['type', 'downloadId', 'pendingKey', 'error'],
      source: 'extension.service_worker',
      target: 'sidepanel.ui',
    },
    DOWNLOAD_PENDING: {
      required: ['type', 'downloadId', 'pendingKey', 'requiresUserConfirmation'],
      source: 'extension.service_worker',
      target: 'sidepanel.ui',
      allowedOnlyWhen: 'requiresUserConfirmation === true',
    },
  },
};
