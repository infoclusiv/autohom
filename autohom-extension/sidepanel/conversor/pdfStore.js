window.AutohomConversorStore = (() => {
  const state = window.AutohomSidepanelState;

  function getPdfs() {
    return state.convPdfs;
  }

  function setPdfs(pdfs) {
    state.convPdfs = Array.isArray(pdfs) ? pdfs : [];
  }

  function getPendingPdfs() {
    return state.convPdfs.filter((pdf) => pdf.status === 'pending' || pdf.status === 'error');
  }

  function updatePdfStatus(pdfId, status, message = '') {
    const pdf = state.convPdfs.find((item) => item.id === pdfId);
    if (!pdf) {
      return null;
    }
    pdf.status = status;
    pdf.message = message || '';
    return pdf;
  }

  function setPollingTimer(timer) {
    state.convPollingTimer = timer;
  }

  function getPollingTimer() {
    return state.convPollingTimer;
  }

  return {
    getPdfs,
    setPdfs,
    getPendingPdfs,
    updatePdfStatus,
    setPollingTimer,
    getPollingTimer,
  };
})();
