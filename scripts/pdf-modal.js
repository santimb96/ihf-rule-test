/**
 * In-app PDF viewer: the rule references and document links used to open a new
 * browser tab; now they open the same deep link (#page=N included) inside a
 * modal, with a plain "open in a tab" escape hatch for browsers that refuse to
 * render PDFs in an iframe (notably iOS).
 */
(function (global) {
  "use strict";

  var R = global.IHFRender;
  var Dialog = global.IHFDialog;
  var el = R.el;

  function decodeFileName(url) {
    var clean = (url || "").split("#")[0].split("?")[0].split("/").pop() || "";
    try {
      return decodeURIComponent(clean);
    } catch (error) {
      return clean;
    }
  }

  function pageOf(url) {
    var hash = (url || "").split("#")[1] || "";
    var match = hash.match(/page=(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function open(options) {
    options = options || {};
    var url = options.url;
    if (!url) return;
    if (document.getElementById("pdf-dialog")) return;

    var page = pageOf(url);
    var file = decodeFileName(url);
    var isRules = /reglas de juego|rules of game/i.test(file);
    var heading = (page || isRules) ? "Reglas de Juego" : options.title || file.replace(/\.pdf$/i, "");
    var subtitle = file + (page ? " · página " + page : "");

    var handle = null;
    var closeButton = Dialog.closeButton(function () {
      if (handle) handle.close();
    });

    var openInTab = el("a", {
      href: url,
      target: "_blank",
      rel: "noopener",
      "aria-label": "Abrir el PDF en una pestaña nueva",
      class:
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white",
      kids: [
        R.icon("doc", "h-4 w-4 shrink-0"),
        el("span", { class: "hidden sm:inline", text: "Abrir en pestaña" }),
      ],
    });

    handle = Dialog.open({
      id: "pdf-dialog",
      labelledBy: "pdf-title",
      initialFocus: closeButton,
      className:
        "flex h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-md border border-slate-200/80 bg-white shadow-lift dark:border-slate-700 dark:bg-slate-900 sm:h-[88vh] sm:rounded-md" +
        (R.reducedMotion() ? "" : " animate-pop-in"),
      children: [
        el(
          "div",
          { class: "flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700 sm:px-5" },
          el(
            "div",
            { class: "min-w-0" },
            el("p", { class: "text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400", text: "Documento" }),
            el("h2", { id: "pdf-title", class: "mt-0.5 font-display text-base font-semibold text-ink dark:text-slate-100", text: heading }),
            el("p", { class: "mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400", text: subtitle }),
          ),
          el("div", { class: "flex shrink-0 items-center gap-2" }, [openInTab, closeButton]),
        ),
        el("iframe", {
          src: url,
          title: heading + (page ? ", página " + page : ""),
          loading: "lazy",
          class: "min-h-0 w-full flex-1 border-0 bg-slate-100 dark:bg-slate-800",
        }),
      ],
    });
  }

  global.IHFPdfModal = { open: open, pageOf: pageOf, decodeFileName: decodeFileName };
})(globalThis);
