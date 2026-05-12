window.AutohomTabsController = (() => {
  function activateTab(tabName) {
    window.AutohomSidepanelDom.qsa('.tab-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });
    window.AutohomSidepanelDom.qsa('.tab-content').forEach((content) => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
  }

  function init() {
    window.AutohomSidepanelDom.qsa('.tab-btn').forEach((button) => {
      button.addEventListener('click', () => {
        activateTab(button.dataset.tab);
        if (button.dataset.tab === 'conversor') {
          window.AutohomConversor.refreshPdfs();
          window.AutohomConversor.checkBridge();
        }
      });
    });
  }

  return {
    init,
    activateTab,
  };
})();
