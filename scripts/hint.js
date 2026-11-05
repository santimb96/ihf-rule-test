/**
 * Shared hint component: a toggle button plus a collapsible panel that shows
 * the guidelines cited by the answer catalogue, each deep-linked into the
 * Rules of Game PDF when a page can be resolved.
 */
(function (global) {
  "use strict";

  var R = global.IHFRender;
  var D = global.IHFData;

  function chipNode(chip, question) {
    var cls =
      "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100/70 px-2.5 py-1 text-xs font-medium text-amber-900 transition hover:border-amber-300 hover:bg-amber-200/80";
    if (chip.page) {
      return R.el("a", {
        class: cls,
        href: D.rulesUrl(chip.page),
        target: "_blank",
        rel: "noopener",
        title: "Abrir las Reglas de Juego en la página " + chip.page,
        text: chip.label,
      });
    }
    return R.el("span", { class: cls, text: chip.label });
  }

  function create(question) {
    var chips = D.chips(question);
    var firstLink = chips.filter(function (c) {
      return c.page;
    })[0];

    var label = R.el("span", { text: "Ver pista" });
    var open = false;

    var panel = R.el(
      "div",
      { class: "hint-panel" },
      R.el(
        "div",
        null,
        R.el(
          "div",
          { class: "mt-4 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-amber-50/60 p-4 shadow-card animate-fade-in" },
          R.el(
            "div",
            { class: "flex flex-wrap items-start justify-between gap-3" },
            R.el(
              "div",
              { class: "min-w-0" },
              R.el("p", { class: "text-[11px] font-semibold uppercase tracking-wider text-amber-600", text: "Pista · directrices de la respuesta" }),
              R.el("div", { class: "mt-2 flex flex-wrap gap-2", kids: chips.map(function(c) { return chipNode(c, question); }) }),
            ),
            firstLink
              ? R.el("a", {
                  class: "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100",
                  href: firstLink.page ? D.rulesUrl(firstLink.page) : "#",
                  target: "_blank",
                  rel: "noopener",
                  kids: [R.icon("doc", "h-4 w-4"), "Ver en las Reglas de Juego"],
                })
              : null,
          ),
          R.el("p", {
            class: "mt-2 text-xs leading-relaxed text-slate-500",
            text: "El catálogo de respuestas cita estas directrices como fundamento de la respuesta correcta.",
          }),
        ),
      ),
    );

    var button = R.el(
      "button",
      {
        type: "button",
        "aria-expanded": "false",
        "data-action": "hint",
        class:
          "inline-flex items-center gap-2 rounded-xl border border-accent-300/70 bg-accent-300/15 px-3.5 py-2 text-sm font-semibold text-amber-700 transition hover:bg-accent-300/30",
        on: {
          click: function () {
            open = !open;
            panel.classList.toggle("open", open);
            button.setAttribute("aria-expanded", String(open));
            label.textContent = open ? "Ocultar pista" : "Ver pista";
            if (open) {
              setTimeout(function () {
                panel.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 120);
            }
          },
        },
        kids: [R.icon("bulb", "h-4 w-4"), label],
      },
    );

    return { button: button, panel: panel };
  }

  global.IHFHint = { create: create };
})(globalThis);
