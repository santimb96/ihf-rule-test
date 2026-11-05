/**
 * Small DOM helpers shared by every screen: element building, screen
 * switching, toasts and the inline icon set loaded asynchronously from assets.
 */
(function (global) {
  "use strict";

  var ICONS = {};
  var iconPromises = {};

  var ICON_NAMES = [
    "check", "alert", "dash", "x", "bulb", "left", "right",
    "flag", "download", "refresh", "grid", "close", "doc", "clock", "github", "issue"
  ];

  ICON_NAMES.forEach(function (name) {
    iconPromises[name] = fetch("./assets/icons/" + name + ".svg")
      .then(function (res) { return res.text(); })
      .then(function (svg) {
        ICONS[name] = svg;
        return svg;
      })
      .catch(function () {
        ICONS[name] = "";
      });
  });

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
    var span = el("span", { class: className || "h-5 w-5" });
    if (ICONS[name]) {
      span.innerHTML = ICONS[name];
    } else if (iconPromises[name]) {
      iconPromises[name].then(function (svg) {
        span.innerHTML = svg;
      });
    }
    return span;
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