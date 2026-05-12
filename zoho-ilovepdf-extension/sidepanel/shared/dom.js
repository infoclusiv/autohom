window.AutohomSidepanelDom = {
  byId(id) {
    return document.getElementById(id);
  },

  qs(selector, root = document) {
    return root.querySelector(selector);
  },

  qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  },
};
