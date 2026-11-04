/**
 * Small DOM helpers shared by every screen: element building, screen
 * switching, toasts and the inline icon set.
 */
(function (global) {
  "use strict";

  var ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v9"/><path d="M12 18.5h.01"/></svg>',
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 12h12"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.7 1 1.4 1 2.5h6c0-1.1.4-1.8 1-2.5A6 6 0 0 0 12 3Z"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10 6 6 6-6 6"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4m0 0h11l-2 4 2 4H5"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-.6 4M20 5v6h-6"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h7v7H4zM13 5h7v4h-7zM13 12h7v7h-7zM4 15h7v4H4z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Zm0 0v5h5M9 13h6M9 17h4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  };

  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) {
      child.forEach(function (c) {
        append(node, c);
      });
      return;
    }
    if (child instanceof Node) {
      node.appendChild(child);
      return;
    }
    node.appendChild(document.createTextNode(String(child)));
  }

  var SVG_NS = "http://www.w3.org/2000/svg";
  var SVG_TAGS = { svg: 1, circle: 1, path: 1, rect: 1, line: 1, g: 1, ellipse: 1, polyline: 1, polygon: 1 };

  function el(tag, props) {
    var node = SVG_TAGS[tag] ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (key) {
      var value = props[key];
      if (value == null || value === false) return;
      // className is read-only on SVG elements, so the attribute is the safe path.
      if (key === "class") node.setAttribute("class", value);
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key === "on") {
        Object.keys(value).forEach(function (evt) {
          node.addEventListener(evt, value[evt]);
        });
      } else if (key !== "kids") node.setAttribute(key, value === true ? "" : value);
    });
    append(node, props.kids);
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function mount(node, children) {
    clear(node);
    append(node, children);
    return node;
  }

  function reducedMotion() {
    return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(function (screen) {
      screen.classList.add("hidden");
    });
    var target = document.getElementById(id);
    target.classList.remove("hidden");
    // Re-trigger the entrance animation.
    target.style.animation = "none";
    void target.offsetHeight;
    target.style.animation = "";
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }

  var toastTimer = null;
  function toast(message) {
    var node = document.getElementById("toast");
    if (node.textContent !== message) node.textContent = message;
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.classList.remove("show");
    }, 2600);
  }

  function icon(name, className) {
    return el("span", { class: className || "h-5 w-5", html: ICONS[name] || "" });
  }

  global.IHFRender = {
    el: el,
    append: append,
    clear: clear,
    mount: mount,
    showScreen: showScreen,
    toast: toast,
    icon: icon,
    ICONS: ICONS,
    reducedMotion: reducedMotion,
  };
})(globalThis);
