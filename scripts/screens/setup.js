/**
 * Setup screen: topic filter, test length picker (5/10/20/30) and start CTA.
 * The pool size drives which lengths are available and the pass requirement.
 */
(function (global) {
  "use strict";

  var R = global.IHFRender;
  var D = global.IHFData;
  var S = global.IHFScoring;
  var el = R.el;

  function mount(root, ctx) {
    var topics = D.topics();
    var selected = new Set(
      topics.map(function (t) {
        return t.id;
      }),
    );
    var size = 10;

    var poolSize = function () {
      return D.pool(Array.from(selected)).length;
    };

    var chipNodes = [];
    var sizeNodes = [];
    var allButton;
    var poolLabel;
    var poolNote;
    var startButton;

    function sync() {
      var available = poolSize();

      chipNodes.forEach(function (entry) {
        var on = selected.has(entry.id);
        if (entry.on === on) return;
        entry.on = on;
        entry.button.setAttribute("aria-pressed", String(on));
        entry.button.className = chipClass(on);
        entry.check.style.opacity = on ? "1" : "0";
        entry.badge.className = chipBadge(on);
      });

      if (allButton) {
        var allOn = selected.size === topics.length;
        var allLabel = allOn ? "Ninguno" : "Todos";
        if (allButton.textContent !== allLabel) allButton.textContent = allLabel;
      }

      var fallback = S.SUPPORTED_LENGTHS.filter(function (n) {
        return n <= available;
      });
      if (available >= 5 && !fallback.includes(size)) size = fallback[fallback.length - 1];

      sizeNodes.forEach(function (entry) {
        var enabled = available >= entry.size && fallback.includes(entry.size);
        var active = entry.size === size && enabled;
        if (entry.enabled !== enabled) {
          entry.enabled = enabled;
          entry.button.disabled = !enabled;
          entry.button.classList.toggle("opacity-40", !enabled);
          entry.button.setAttribute("aria-pressed", String(active));
        }
        if (entry.active !== active) {
          entry.active = active;
          entry.button.classList.toggle("size-active", active);
          entry.button.setAttribute("aria-pressed", String(active));
        }
        var hint = !enabled ? "no hay suficientes preguntas" : "";
        if (entry.hint.textContent !== hint) entry.hint.textContent = hint;
        // New: show notice when pool has < 5 questions but test proceeds
        if (available < entry.size && entry.size === 5 && available >= 1) {
          entry.hint.textContent = "solo " + available + " disponibles";
        }
      });

      var label = available + (available === 1 ? " pregunta disponible" : " preguntas disponibles");
      if (poolLabel.textContent !== label) poolLabel.textContent = label;
      var note;
      var noteClass;
      if (available < 5) {
        note = "Necesitas al menos 5 preguntas: selecciona más temas.";
        noteClass = "text-xs font-medium text-rose-600";
      } else {
        note = "Aprobado con ≥75% de las respuestas · " + size + " preguntas";
        noteClass = "text-xs text-slate-500";
      }
      if (poolNote.textContent !== note) poolNote.textContent = note;
      if (poolNote.className !== noteClass) poolNote.className = noteClass;
      var startOff = available < 5;
      if (startButton.disabled !== startOff) startButton.disabled = startOff;
    }

    function chipClass(on) {
      return (
        "option flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left " +
        (on
          ? "border-brand-500 bg-brand-50/80 shadow-card ring-1 ring-brand-500"
          : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-card")
      );
    }

    function chipBadge(on) {
      return (
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-sm font-semibold transition " +
        (on ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600")
      );
    }

    function buildChip(topic) {
      var check = el("span", {
        class: "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-white transition-opacity p-1",
        style: { opacity: "0" },
        kids: [R.icon("check", "h-4 w-4 text-white")],
      });
      var badge = el("span", { class: chipBadge(false), text: topic.id === "SAR" ? "ZC" : topic.id });
      var count = D.pool([topic.id]).length;
      var button = el(
        "button",
        {
          type: "button",
          "aria-pressed": "false",
          "data-topic": topic.id,
          class: chipClass(false),
          on: {
            click: function () {
              if (selected.has(topic.id)) selected.delete(topic.id);
              else selected.add(topic.id);
              sync();
            },
          },
        },
        badge,
        el(
          "span",
          { class: "min-w-0 flex-1" },
          el("span", { class: "block truncate text-sm font-semibold text-ink", text: topic.label }),
          el("span", { class: "block text-xs text-slate-500", text: count + (count === 1 ? " pregunta" : " preguntas") }),
        ),
        check,
      );
      chipNodes.push({ id: topic.id, button: button, check: check, badge: badge });
      return button;
    }

    function calculateTime(n){
        if (n <= 5) return 10;
        if (n <= 10) return 15;
        if (n <= 20) return 25;
        return 35;
    }

    function buildSizeButton(n) {
      var hint = el("span", { class: "block text-[11px] text-slate-500" });
      var button = el(
        "button",
        {
          type: "button",
          "data-size": String(n),
          "aria-pressed": "false",
          class: "option group relative rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center transition",
          on: {
            click: function () {
              if (button.disabled) return;
              size = n;
              sync();
            },
          },
        },
        el("span", { class: "block font-display text-3xl font-bold text-ink", text: String(n) }),
        el("span", { class: "mt-0.5 block text-xs font-normal text-slate-500", text: "preguntas" }),
        el("strong", { class: "mt-0.5 block text-xs font-semibold text-slate-500", text: calculateTime(n) + " minutos apróx." }),
        hint,
      );
      sizeNodes.push({ size: n, button: button, hint: hint });
      return button;
    }

    var hero = el(
      "div",
      { class: "relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 p-6 text-white shadow-lift sm:p-8" },
      el("div", {
        class: "pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-400/25 blur-2xl",
      }),
      el("div", {
        class: "pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-brand-400/30 blur-2xl",
      }),
      el(
        "div",
        { class: "relative" },
        el("p", { class: "text-xs font-semibold uppercase tracking-[0.18em] text-accent-300", text: "Basado en el catálogo oficial IHF · válido desde el 1 de julio de 2025" }),
        el("h1", { class: "mt-2 font-display text-3xl font-bold leading-tight text-balance sm:text-4xl", text: "Prepara tu test de reglas de juego" }),
        el("p", {
          class: "mt-3 max-w-2xl text-sm leading-relaxed text-brand-100/90 sm:text-base",
          text: D.meta.questionCount +
            " preguntas con sus respuestas y las directrices en las que se basan, extraídas de los catálogos oficiales. Filtra por tema, elige la longitud del test y responde a las preguntas.",
        }),
        el(
          "div",
          { class: "mt-5 flex flex-wrap gap-2" },
          [
            D.meta.questionCount + " preguntas",
            D.topics().length + " temas",
            "Aprobado ≥ 75%",
          ].map(function (text) {
            return el("span", {
              class: "rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/95 backdrop-blur",
              text: text,
            });
          }),
        ),
      ),
    );

    var topicsCard = el(
      "section",
      { class: "mt-6 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6" },
      el(
        "div",
        { class: "flex flex-wrap items-center justify-between gap-3" },
        el(
          "div",
          { class: "flex items-start gap-3" },
          el("span", { class: "font-display text-4xl font-bold text-brand-600 mr-2", text: "1" }),
          el("div", null,
            el("h2", { class: "font-display text-lg font-semibold text-ink", text: "Temas del test" }),
            el("p", { class: "text-xs text-slate-500", text: "Selecciona los temas de las Reglas de Juego que quieres practicar" }),
          ),
        ),
        (allButton = el(
          "button",
          {
            type: "button",
            "data-action": "toggle-all",
            class: "rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 active:translate-y-px",
            on: {
              click: function () {
                if (selected.size === topics.length) selected.clear();
                else topics.forEach(function (t) { selected.add(t.id); });
                sync();
              },
            },
            text: "Todos",
          },
        )),
      ),
      el("div", {
        class: "mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
        kids: topics.map(buildChip),
      }),
    );

    var sizesCard = el(
      "section",
      { class: "mt-6 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6" },
      el(
        "div",
        { class: "flex items-start gap-3" },
        el("span", { class: "font-display text-4xl font-bold text-brand-600 mr-2", text: "2" }),
        el("div", null,
          el("h2", { class: "font-display text-lg font-semibold text-ink", text: "Preguntas por cuestionario" }),
          el("p", { class: "text-xs text-slate-500", text: "Se aprueba con un 75% o más de respuestas correctas. " },
            el("strong", { class: "text-bold", text: "Cada pregunta puede tener una o varias opciones." })
          ),
        ),
      ),
      el("div", {
        class: "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4",
        kids: S.SUPPORTED_LENGTHS.map(buildSizeButton),
      }),
    );

    poolLabel = el("p", { class: "text-sm font-semibold text-ink" });
    poolNote = el("p", { class: "text-xs text-slate-500" });
    startButton = el(
      "button",
      {
        type: "button",
        "data-action": "start",
        class:
          "group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 px-7 py-3.5 font-semibold text-white shadow-lift transition hover:-translate-y-0.5 hover:from-brand-500 hover:to-brand-400 active:translate-y-0 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto",
        on: {
          click: function () {
            if (startButton.disabled) return;
            ctx.onStart({ topics: Array.from(selected), size: size });
          },
        },
        kids: ["Comenzar test", R.icon("right", "h-5 w-5 transition-transform group-hover:translate-x-0.5")],
      },
    );

    var summary = el(
      "div",
      { class: "mt-6 flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between" },
      el("div", null, poolLabel, poolNote),
      startButton,
    );

    R.mount(root, [hero, topicsCard, sizesCard, summary]);
    sync();
  }

  global.IHFScreens = global.IHFScreens || {};
  global.IHFScreens.setup = { mount: mount };
})(globalThis);
