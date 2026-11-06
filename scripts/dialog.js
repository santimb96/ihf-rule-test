/**
 * Shared modal shell: overlay, focus trap, Escape/backdrop close, body scroll
 * lock, `aria-hidden` on the page tree and focus restoration. Callers only
 * provide the dialog content and its classes.
 */
(function (global) {
  "use strict";

  var R = global.IHFRender;
  var el = R.el;

  /** The labelled close control both dialogs use: an icon alone reads as
   *  "dismiss?"; the word removes the guess. */
  function closeButton(onClick, label) {
    return el(
      "button",
      {
        type: "button",
        class:
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white",
        on: { click: onClick },
        kids: [R.icon("close", "h-4 w-4 shrink-0"), el("span", { text: label || "Cerrar" })],
      },
    );
  }

  function open(options) {
    options = options || {};
    if (options.id && document.getElementById(options.id)) return null;

    var previousFocus = document.activeElement;
    var previousOverflow = document.body.style.overflow;
    var app = document.getElementById("app");
    var appAriaHidden = app ? app.getAttribute("aria-hidden") : null;
    var closed = false;

    var dialog = el(
      "div",
      {
        id: options.id,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": options.labelledBy,
        class: options.className || "",
      },
      options.children,
    );

    var overlay = el(
      "div",
      {
        class:
          options.overlayClass ||
          "fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-6" +
            (R.reducedMotion() ? "" : " animate-fade-in"),
        on: {
          click: function (event) {
            if (event.target === overlay) close();
          },
        },
      },
      dialog,
    );

    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      var focusables = dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKeydown);
      document.body.style.overflow = previousOverflow;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (app) {
        if (appAriaHidden === null) app.removeAttribute("aria-hidden");
        else app.setAttribute("aria-hidden", appAriaHidden);
      }
      if (typeof options.onClose === "function") options.onClose();
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeydown);
    document.body.appendChild(overlay);

    var initial = options.initialFocus || dialog.querySelector('a[href], button:not([disabled])');
    if (initial && typeof initial.focus === "function") initial.focus();
    // The dialog lives outside #app, so hiding the page tree from assistive
    // technology keeps the modal as the only reachable content.
    if (app) app.setAttribute("aria-hidden", "true");

    return { dialog: dialog, overlay: overlay, close: close };
  }

  global.IHFDialog = { open: open, closeButton: closeButton };
})(globalThis);
