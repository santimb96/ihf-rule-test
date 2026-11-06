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
    var topicSummary;
    var topicGrid;
    var topicToggle;
    // On phones the 19-topic catalogue pushed the CTA three screens down; the
    // list starts folded there and the sticky summary carries the action.
    var topicsExpanded = !(global.matchMedia && global.matchMedia("(max-width: 1023px)").matches);

    function sync() {
      var available = poolSize();

      chipNodes.forEach(function (entry) {
        var on = selected.has(entry.id);
        if (entry.on === on) return;
        entry.on = on;
        entry.button.setAttribute("aria-pressed", String(on));
        entry.button.className = chipClass(on);
        entry.check.className = chipCheck(on);
        entry.icon.style.opacity = on ? "1" : "0";
        entry.badge.className = chipBadge(on);
      });

      if (allButton) {
        var allOn = selected.size === topics.length;
        var allLabel = allOn ? "Quitar todos" : "Seleccionar todos";
        if (allButton.textContent !== allLabel) allButton.textContent = allLabel;
      }

      if (topicSummary) {
        var summaryText =
          selected.size === topics.length
            ? "Todos los temas · " + available + " preguntas"
            : selected.size + " de " + topics.length + " temas · " + available + " preguntas";
        if (topicSummary.textContent !== summaryText) topicSummary.textContent = summaryText;
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
        noteClass = "text-xs font-medium text-rose-700";
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
        "option flex w-full items-center gap-3 rounded border px-3.5 py-3 text-left " +
        (on
          ? "border-brand-500 bg-brand-50/80 shadow-card ring-1 ring-brand-500 dark:border-brand-500 dark:bg-brand-900/40"
          : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-card dark:border-slate-700 dark:bg-slate-800/60")
      );
    }

    // Rule codes read as codes, not as counters, so they ship in the data face.
    function chipBadge(on) {
      return (
        "grid h-8 min-w-8 shrink-0 place-items-center rounded border px-1.5 font-mono text-xs font-semibold tabular-nums transition " +
        (on
          ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/60 dark:text-brand-200"
          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400")
      );
    }

    function chipCheck(on) {
      return (
        "grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition " +
        (on
          ? "border-brand-600 bg-brand-600"
          : "border-slate-300 bg-transparent dark:border-slate-600")
      );
    }

    function buildChip(topic) {
      var checkIcon = R.icon("check", "h-3.5 w-3.5 text-white");
      checkIcon.style.opacity = "0";
      var check = el("span", { class: chipCheck(false), kids: [checkIcon] });
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
          el("span", { class: "block text-sm font-semibold leading-snug text-ink", text: topic.label }),
          el("span", { class: "block text-xs text-slate-600", text: count + (count === 1 ? " pregunta" : " preguntas") }),
        ),
        check,
      );
      chipNodes.push({ id: topic.id, button: button, check: check, icon: checkIcon, badge: badge });
      return button;
    }

    // Reading-time estimate, kept deliberately secondary to the question count
    // (the test length is the real figure; the minutes are an approximation).
    function estimateMinutes(n) {
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
          class: "option group relative rounded border border-slate-200 bg-white px-4 py-4 text-center transition",
          on: {
            click: function () {
              if (button.disabled) return;
              size = n;
              sync();
            },
          },
        },
        el("span", { class: "block font-display text-2xl font-bold text-ink", text: String(n) }),
        el("span", { class: "mt-0.5 block text-xs font-normal text-slate-500", text: "preguntas" }),
        el("span", {
          class: "mt-1 block text-xs font-medium text-slate-500",
          text: estimateMinutes(n) + " minutos aprox.",
        }),
        hint,
      );
      sizeNodes.push({ size: n, button: button, hint: hint });
      return button;
    }

    // Background texture with intent: a regulation handball court drawn in
    // line art, cropped by the hero. Replaces the two blurred colour blobs
    // that were pure filler behind the headline.
    var courtSvg = el("svg", {
      viewBox: "0 0 400 200",
      width: "820",
      height: "410",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "3",
      "aria-hidden": "true",
      focusable: "false",
      kids: [
        el("rect", { x: "1.5", y: "1.5", width: "397", height: "197" }),
        el("line", { x1: "200", y1: "1.5", x2: "200", y2: "198.5" }),
        el("path", { d: "M1.5 25 A60 60 0 0 1 60 85 L60 115 A60 60 0 0 1 1.5 175" }),
        el("path", { d: "M398.5 25 A60 60 0 0 0 340 85 L340 115 A60 60 0 0 0 398.5 175" }),
        el("line", { x1: "1.5", y1: "85", x2: "1.5", y2: "115", "stroke-width": "9" }),
        el("line", { x1: "398.5", y1: "85", x2: "398.5", y2: "115", "stroke-width": "9" }),
      ],
    });

    var hero = el(
      "div",
      { class: "relative overflow-hidden rounded-md bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 p-6 text-white shadow-lift sm:p-8" },
      el("div", {
        class: "pointer-events-none absolute -right-20 top-1/2 hidden -translate-y-1/2 text-white opacity-[0.15] sm:block",
        kids: [courtSvg],
      }),
      el(
        "div",
        { class: "relative flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10" },
        el(
          "div",
          { class: "min-w-0 flex-1" },
          el("h1", { class: "font-display text-3xl font-bold leading-tight text-balance sm:text-4xl", text: "Prepara tu test de reglas de juego" }),
          el("p", {
            class: "mt-3 max-w-xl text-sm leading-relaxed text-brand-100/90 sm:text-base",
            text: D.meta.questionCount +
              " preguntas con sus respuestas y las directrices en las que se basan, extraídas del catálogo oficial IHF (ed. julio 2025). Filtra por tema, elige la longitud del test y responde a las preguntas.",
          }),
          // The pass rule is the one datum a first-time visitor needs before
          // starting, and it is real (PASS_RATIO in scoring.js), unlike the
          // removed "≈ minutes" strip.
          el(
            "p",
            {
              class: "mt-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90 sm:text-sm",
            },
            R.icon("check", "h-3.5 w-3.5 shrink-0 text-accent-300"),
            "Se aprueba con ≥75% de respuestas correctas",
          ),
          // No "200 preguntas · 19 temas" pill row: the sentence above already
          // states those figures with their source. A second strip of bare
          // numbers is decoration, not information.
        ),
        // Real product screenshot (no stock imagery): the results screen of a
        // genuine test run, captured from this build.
        el(
          "figure",
          { class: "shrink-0 lg:w-[440px]" },
          el("img", {
            src: "assets/screenshots/results-screen.png",
            alt: "Pantalla de resultados de un test: anillo con el porcentaje de aciertos, botones para descargar el informe PDF o repetir el test y revisión pregunta a pregunta",
            width: "1440",
            height: "900",
            decoding: "async",
            class: "w-full border border-white/25 shadow-2xl",
          }),
          el("figcaption", { class: "mt-2 text-[11px] leading-snug text-white/60", text: "Así se ve el informe al terminar un test." }),
        ),
      ),
    );

    var topicsCard = el(
      "section",
      { class: "mt-6 rounded-md border border-slate-200/80 bg-white p-5 shadow-card sm:p-6" },
      el(
        "div",
        { class: "flex flex-wrap items-start justify-between gap-3" },
        el(
          "div",
          { class: "flex items-start gap-3" },
          el("span", { class: "mr-2 font-display text-4xl font-bold text-brand-600 dark:text-brand-400", text: "1" }),
          el("div", null,
            el("h2", { class: "font-display text-lg font-semibold text-ink", text: "Temas del test" }),
            (topicSummary = el("p", { class: "text-xs text-slate-500" })),
          ),
        ),
        el(
          "div",
          { class: "flex flex-wrap items-center gap-2" },
          (allButton = el(
            "button",
            {
              type: "button",
              "data-action": "toggle-all",
              class: "rounded border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 active:translate-y-px dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:bg-brand-900/40 dark:hover:text-brand-200",
              on: {
                click: function () {
                  if (selected.size === topics.length) selected.clear();
                  else topics.forEach(function (t) { selected.add(t.id); });
                  sync();
                },
              },
              text: "Quitar todos",
            },
          )),
          (topicToggle = el(
            "button",
            {
              type: "button",
              "data-action": "toggle-topics",
              "aria-expanded": "false",
              "aria-controls": "topic-grid",
              class: "rounded border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 active:translate-y-px dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:bg-brand-900/40 dark:hover:text-brand-200",
              on: {
                click: function () {
                  topicsExpanded = !topicsExpanded;
                  syncTopics();
                },
              },
              text: "Ver temas",
            },
          )),
        ),
      ),
      (topicGrid = el("div", {
        id: "topic-grid",
        class: "mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3",
        kids: topics.map(buildChip),
      })),
    );

    function syncTopics() {
      topicGrid.classList.toggle("hidden", !topicsExpanded);
      topicToggle.setAttribute("aria-expanded", String(topicsExpanded));
      topicToggle.textContent = topicsExpanded ? "Ocultar temas" : "Ver temas";
    }

    var sizesCard = el(
      "section",
      { class: "mt-6 rounded-md border border-slate-200/80 bg-white p-5 shadow-card sm:p-6" },
      el(
        "div",
        { class: "flex items-start gap-3" },
        el("span", { class: "mr-2 font-display text-4xl font-bold text-brand-600 dark:text-brand-400", text: "2" }),
        el("div", null,
          el("h2", { class: "font-display text-lg font-semibold text-ink", text: "Preguntas por cuestionario" }),
          el("p", { class: "text-xs text-slate-500", text: "Se aprueba con un 75% o más de respuestas correctas. " },
            el("strong", { class: "font-semibold text-ink", text: "Una o varias respuestas correctas por pregunta." })
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
          "group inline-flex w-full items-center justify-center gap-2 rounded bg-gradient-to-r from-brand-600 to-brand-500 px-7 py-3.5 font-semibold text-white shadow-lift transition hover:-translate-y-0.5 hover:from-brand-500 hover:to-brand-400 active:translate-y-0 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto",
        on: {
          click: function () {
            if (startButton.disabled) return;
            ctx.onStart({ topics: Array.from(selected), size: size });
          },
        },
        kids: ["Comenzar test", R.icon("right", "h-5 w-5 transition-transform group-hover:translate-x-0.5")],
      },
    );

    // Sticky on phones: `bottom` keeps the CTA in view while the catalogue
    // scrolls, then it settles into the page flow at its natural position.
    var summary = el(
      "div",
      { class: "sticky bottom-3 z-30 mt-6 flex flex-col gap-4 rounded-md border border-slate-200/80 bg-white/95 p-5 shadow-lift backdrop-blur sm:static sm:flex-row sm:items-center sm:justify-between sm:bg-white dark:border-slate-700 dark:bg-slate-900/95 sm:dark:bg-slate-900" },
      el("div", null, poolLabel, poolNote),
      startButton,
    );

    // Supplementary context, deliberately not another floating card: the page
    // already has two tool panels, so this closes with a rule instead.
    var gitHubCard = el(
      "section",
      { class: "mt-8 border-t border-slate-200 pt-6 dark:border-slate-800" },
      el(
        "div",
        { class: "flex items-center gap-3" },
        R.icon("github", "h-6 w-6 shrink-0 text-slate-500"),
        el("h2", { class: "font-display text-lg font-semibold text-ink", text: "Sobre este proyecto" }),
      ),
      el("p", {
        class: "mt-3 max-w-lg text-sm leading-relaxed text-slate-500",
        text: "Esta web es una herramienta de estudio que no está vinculada con ningún organismo oficial. Los datos expuestos son de dominio público. ¡Puedes consultar el proyecto y compartirlo si te ha sido de utilidad!",
      }),
      el(
        "div",
        { class: "mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold" },
        el(
          "a",
          {
            href: "https://github.com/santimb96/non-official-ihf-rule-test",
            target: "_blank",
            rel: "noopener",
            class: "inline-flex items-center gap-1.5 text-brand-700 underline-offset-4 transition hover:underline dark:text-brand-300",
            kids: [R.icon("github", "h-4 w-4"), "Ver el proyecto en GitHub"],
          },
        ),
        el("a", {
          href: "https://github.com/santimb96/non-official-ihf-rule-test/issues",
          target: "_blank",
          rel: "noopener",
          class: "inline-flex items-center gap-1.5 text-slate-600 underline-offset-4 transition hover:text-brand-700 hover:underline dark:text-slate-300 dark:hover:text-brand-300",
          kids: [R.icon("issue", "h-4 w-4 shrink-0"), "Abrir una issue"],
        }),
      ),
    );

    R.mount(root, [hero, topicsCard, sizesCard, summary, gitHubCard]);
    sync();
    syncTopics();
  }

  global.IHFScreens = global.IHFScreens || {};
  global.IHFScreens.setup = { mount: mount };
})(globalThis);
