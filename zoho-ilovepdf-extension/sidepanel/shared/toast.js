window.AutohomToast = {
  show(msg) {
    const toast = window.AutohomSidepanelDom.byId('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  },
};
