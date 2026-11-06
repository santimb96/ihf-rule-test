/**
 * Results screen: pass/fail hero with an animated score ring, action bar
 * (PDF, retry, new test) and a filterable per-question review with hints.
 */
(function (global) {
  "use strict";

  var R = global.IHFRender;
  var D = global.IHFData;
  var Hint = global.IHFHint;
  var Scoring = global.IHFScoring;
  var el = R.el;

  var CIRCUMFERENCE = 2 * Math.PI * 54;

  // Status pill copy per classification. A partial sweep is not a plain miss,
  // and an unanswered question is not a wrong answer. The classification
  // itself lives in IHFScoring.questionStatus so the stats history and this
  // screen can never disagree.
  var STATUS_PILL = {
    correct: { label: "Acertada", icon: "check", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
    unanswered: { label: "Sin responder", icon: "dash", tone: "bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-200" },
    wrong: { label: "Fallada", icon: "x", tone: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
    partial: { label: "Parcial", icon: "alert", tone: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200" },
  };

  // Option row states in the review list. "missed" is a correct answer the user
  // never picked: amber with an alert so it never reads as a hit.
  var OPTION_STATE = {
    hit: { tone: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/40", badge: "bg-emerald-700 text-white", text: "text-slate-800 dark:text-emerald-50", icon: "check", iconCls: "text-emerald-600 dark:text-emerald-300" },
    missed: { tone: "border-amber-200 bg-amber-50/80 dark:border-amber-800/70 dark:bg-amber-950/40", badge: "bg-amber-400 text-amber-950", text: "text-slate-800 dark:text-amber-50", icon: "alert", iconCls: "text-amber-700 dark:text-amber-300" },
    wrong: { tone: "border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/40", badge: "bg-rose-700 text-white", text: "text-slate-800 dark:text-rose-50", icon: "x", iconCls: "text-rose-600 dark:text-rose-300" },
    plain: { tone: "border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40", badge: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200", text: "text-slate-500 dark:text-slate-300", icon: null, iconCls: null },
  };

  function reviewCard(result) {
    var q = result.question;
    var hint = Hint.create(q, { subtle: true });
    var unanswered = result.selected.length === 0;

    // Status pill comes straight from the shared classification.
    var status = STATUS_PILL[result.status] || STATUS_PILL[Scoring.STATUS.unanswered];

    var optionRows = q.options.map(function (opt) {
      var inKey = q.answer.includes(opt.letter);
      var picked = result.selected.includes(opt.letter);
      var state = OPTION_STATE[inKey && picked ? "hit" : inKey ? "missed" : picked ? "wrong" : "plain"];
      return el(
        "li",
        { class: "flex items-center gap-2.5 rounded border px-3 py-2 " + state.tone },
        el("span", { class: "grid h-6 w-6 shrink-0 place-items-center rounded text-[11px] font-bold " + state.badge, text: opt.letter }),
        el("span", { class: "flex-1 text-xs leading-relaxed " + state.text, text: opt.text }),
        state.icon ? R.icon(state.icon, "h-4 w-4 shrink-0 " + state.iconCls) : null,
      );
    });

    // Answer comparison as tinted chips so "yours" vs "the key" scans at a
    // glance; the "yours" chip borrows the status tone, so a partial sweep
    // reads amber instead of red.
    var answerLine = el(
      "div",
      { class: "mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800" },
      el("span", { class: "inline-flex items-center gap-2" }, [
        el("span", { class: "text-slate-500", text: "Tu respuesta" }),
        el("span", {
          class: "rounded px-2 py-1 font-bold " + status.tone,
          text: unanswered ? "sin responder" : result.selected.join(", "),
        }),
      ]),
      el("span", { class: "inline-flex items-center gap-2" }, [
        el("span", { class: "text-slate-500", text: "Respuesta correcta" }),
        el("span", { class: "rounded bg-emerald-100 px-2 py-1 font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", text: q.answer.join(", ") }),
      ]),
    );

    return el(
      "article",
      {
        class: "review-card relative rounded-md border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800",
      },
      el(
        "div",
        { class: "" },
        el(
          "div",
          { class: "flex flex-wrap items-center justify-between gap-3" },
          el(
            "div",
            { class: "flex flex-wrap items-center gap-2" },
            el("span", {
              class: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide " + status.tone,
              kids: [R.icon(status.icon, "h-3.5 w-3.5"), status.label],
            }),
            el("span", { class: "rounded bg-brand-600 px-1.5 py-0.5 font-display text-[11px] font-bold text-white", text: q.id }),
            el("span", { class: "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300", text: D.topicLabel(q.topic) }),
          ),
          hint.button,
        ),
        // Review questions are read, not scanned: ~60ch keeps every line
        // under 80 characters instead of the ~92 the full card width gave.
        el("p", { class: "mt-3 max-w-[60ch] text-sm font-medium leading-relaxed text-ink", text: q.text }),
        el("ul", { class: "mt-3 space-y-2", kids: optionRows }),
        answerLine,
        hint.panel,
      ),
    );
  }

  function mount(root, ctx) {
    var report = ctx.report;
    var config = ctx.config;
    var failedCount = report.results.filter(function (r) {
      return !r.correct;
    }).length;
    // A failed attempt opens on its misses: reviewing them is the study moment.
    var filter = report.passed ? "all" : "failed";

    var ringStroke = el("circle", {
      class: "ring-progress " + (report.passed ? "stroke-emerald-600 dark:stroke-emerald-400" : "stroke-rose-600 dark:stroke-rose-400"),
      cx: "60",
      cy: "60",
      r: "54",
      fill: "none",
      "stroke-width": "10",
      "stroke-linecap": "round",
      "stroke-dasharray": String(CIRCUMFERENCE),
      "stroke-dashoffset": String(CIRCUMFERENCE),
    });

    var listHost = el("div", { class: "review-list space-y-3" });
    var tabNodes = [];
    var cards = [];
    var shown = {};

    function matches(r) {
      if (filter === "correct") return r.correct;
      if (filter === "failed") return !r.correct;
      return true;
    }

    function cardAt(position) {
      if (!cards[position]) cards[position] = reviewCard(report.results[position]);
      return cards[position];
    }

    // Cards are built once and re-attached, so filtering neither rebuilds nor
    // re-animates the cards already on screen; only newly revealed ones fade in.
    function renderList() {
      var nextShown = {};
      var fresh = 0;
      var nodes = [];
      report.results.forEach(function (r, i) {
        if (!matches(r)) return;
        var card = cardAt(i);
        if (!shown[i]) {
          var delay = Math.min(fresh * 30, 300);
          fresh += 1;
          card.style.animationDelay = delay + "ms";
          card.classList.add("animate-fade-up");
          (function (node, removeAt) {
            setTimeout(function () {
              node.classList.remove("animate-fade-up");
            }, removeAt);
          })(card, delay + 550);
        }
        nextShown[i] = true;
        nodes.push(card);
      });
      shown = nextShown;
      R.clear(listHost);
      R.append(
        listHost,
        nodes.length
          ? nodes
          : [el("p", { class: "rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500", text: "No hay preguntas en esta categoría." })],
      );
      listHost.classList.toggle("is-long", nodes.length >= 12);
    }

    function tabClass(active) {
      return (
        "rounded px-4 py-2 text-sm font-semibold transition " +
        (active ? "bg-brand-600 text-white shadow-card" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")
      );
    }

    function buildTab(key, label, count) {
      var active = key === filter;
      var button = el("button", {
        type: "button",
        "data-filter": key,
        "aria-pressed": String(active),
        class: tabClass(active),
        on: {
          click: function () {
            filter = key;
            tabNodes.forEach(function (t) {
              var on = t.key === filter;
              t.button.className = tabClass(on);
              t.button.setAttribute("aria-pressed", String(on));
            });
            renderList();
          },
        },
        kids: [label + " ", el("span", { class: "text-xs opacity-70", text: String(count) })],
      });
      tabNodes.push({ key: key, button: button });
      return button;
    }

    var topicIds = config.topics;
    var topicSummary =
      topicIds.length === D.topics().length
        ? "Todos los temas"
        : topicIds.length <= 4
          ? topicIds
              .map(function (id) {
                return D.topicLabel(id);
              })
              .join(", ")
          : topicIds.length + " temas seleccionados";

    // Fail: studying the misses is the primary action. Pass: the record (PDF) is.
    var PRIMARY_CLASS =
      "group inline-flex items-center justify-center gap-2 rounded bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lift transition hover:-translate-y-0.5 active:translate-y-0 active:brightness-95 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0";
    var SECONDARY_CLASS =
      "inline-flex items-center justify-center gap-2 rounded border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 active:translate-y-px disabled:cursor-wait disabled:opacity-60";
    var DANGER_CLASS =
      "inline-flex items-center justify-center gap-2 rounded border border-rose-300 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 active:translate-y-px dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60";

    // Download owns a busy state: the PDF generator is fetched on demand, so the
    // button reports the wait and returns a retry when the fetch fails.
    var downloadLabel = el("span", { text: "Descargar PDF" });
    var downloadButton = el(
      "button",
      {
        type: "button",
        class: report.passed ? PRIMARY_CLASS : SECONDARY_CLASS,
        "data-action": "download",
        on: {
          click: function () {
            if (downloadButton.disabled) return;
            downloadButton.disabled = true;
            downloadButton.setAttribute("aria-busy", "true");
            downloadLabel.textContent = "Generando PDF…";
            ctx.onDownload(function restore() {
              downloadButton.disabled = false;
              downloadButton.removeAttribute("aria-busy");
              downloadLabel.textContent = "Descargar PDF";
            });
          },
        },
        kids: [R.icon("download", "h-4 w-4"), downloadLabel],
      },
    );

    var retryButton = el(
      "button",
      {
        type: "button",
        class: SECONDARY_CLASS,
        "data-action": "retry",
        on: { click: ctx.onRetry },
        kids: [R.icon("refresh", "h-4 w-4"), "Repetir test"],
      },
    );

    var newButton = el(
      "button",
      {
        type: "button",
        class: SECONDARY_CLASS,
        "data-action": "new",
        on: { click: ctx.onNew },
        kids: [R.icon("grid", "h-4 w-4"), "Nuevo test"],
      },
    );

    var retryFailedButton = failedCount
      ? el(
          "button",
          {
            type: "button",
            class: report.passed ? DANGER_CLASS : PRIMARY_CLASS,
            "data-action": "retry-failed",
            on: { click: ctx.onRetryFailed },
            kids: [
              R.icon("refresh", "h-4 w-4"),
              failedCount === 1 ? "Repetir el fallo" : "Repetir los " + failedCount + " fallos",
            ],
          },
        )
      : null;

    var hero = el(
      "section",
      {
        class:
          "relative overflow-hidden rounded-md border p-6 shadow-lift sm:p-8 animate-fade-up " +
          (report.passed
            ? "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 dark:border-emerald-900 dark:from-emerald-950 dark:via-slate-900 dark:to-slate-950"
            : "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50/60 dark:border-rose-900 dark:from-rose-950 dark:via-slate-900 dark:to-slate-950"),
      },
      el(
        "div",
        // The three-column hero (ring · copy · actions) needs real width for
        // the display headline; below lg it stacks, which is also the better
        // reading order on tablets.
        { class: "relative flex flex-col items-center gap-6 px-3 lg:flex-row lg:gap-8 lg:pr-0" },
        el(
          "div",
          { class: "relative h-36 w-36 shrink-0" },
          el(
            "svg",
            { viewBox: "0 0 120 120", class: "h-36 w-36 -rotate-90" },
            el("circle", { cx: "60", cy: "60", r: "54", fill: "none", class: "stroke-slate-200 dark:stroke-slate-700", "stroke-width": "10" }),
            ringStroke,
          ),
          el(
            "div",
            { class: "absolute inset-0 flex flex-col items-center justify-center gap-1" },
            el("span", { class: "font-display text-3xl font-bold text-ink", text: report.percentage + "%" }),
            el("span", { class: "text-[11px] font-medium uppercase tracking-wide text-slate-500", text: "respuestas" }),
          ),
        ),
        el(
          "div",
          { class: "min-w-0 flex-1 text-center lg:text-left" },
          el("span", {
            class: "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider " + (report.passed ? "bg-emerald-700 text-white" : "bg-rose-700 text-white"),
            kids: [R.icon(report.passed ? "check" : "x", "h-3.5 w-3.5"), report.passed ? "Aprobado" : "No aprobado"],
          }),
          el("h1", { class: "mt-3 font-display text-3xl font-bold text-ink text-balance sm:text-4xl", text: report.passed ? "¡Enhorabuena, has aprobado!" : "¡Esta vez no ha sido posible!" }),
          el("p", { class: "mt-2 text-sm leading-relaxed text-slate-600" }, [
            "Has acertado ",
            el("strong", { class: "font-semibold text-ink", text: report.score + " de " + report.totalAnswers + " respuestas" }),
            report.passed
              ? " (" + report.percentage + "%), por encima del 75% exigido."
              : " (" + report.percentage + "%). Necesitabas " + report.required + " respuestas correctas para aprobar (75%).",
          ]),
          el(
            "div",
            { class: "mt-4 flex flex-wrap justify-center gap-2 lg:justify-start" },
            [
              config.size + " preguntas",
              topicSummary,
              "mín. " + report.required + " respuestas",
              report.elapsedTime !== undefined ? "Tiempo: " + Math.floor(report.elapsedTime / 60) + "m " + (report.elapsedTime % 60) + "s" : null,
              new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }),
            ].filter(Boolean).map(function (text) {
              return el("span", { class: "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200", text: text });
            }),
          ),
        ),
        el(
          "div",
          { class: "flex w-full flex-col gap-2.5 lg:w-auto lg:shrink-0" },
          (report.passed ? [downloadButton, retryFailedButton, retryButton, newButton] : [retryFailedButton, downloadButton, retryButton, newButton]).filter(Boolean),
        ),
      ),
    );

    function legendItem(tone, label) {
      return el(
        "span",
        { class: "inline-flex items-center gap-1.5" },
        el("span", { class: "h-2.5 w-2.5 rounded-full " + tone }),
        label,
      );
    }

    // A legend is a reading aid, not a container: plain row, no box.
    var legend = el(
      "div",
      {
        class:
          "mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-slate-600 dark:text-slate-400",
      },
      [
        legendItem("bg-emerald-500", "Acertada"),
        legendItem("bg-amber-500", "Correcta que no marcaste"),
        legendItem("bg-rose-500", "Fallada"),
        legendItem("bg-slate-400", "Sin responder"),
      ],
    );

    var review = el(
      "section",
      { class: "mt-6" },
      el(
        "div",
        { class: "flex flex-wrap items-center justify-between gap-3" },
        el("h2", { class: "font-display text-lg font-semibold text-ink", text: "Revisión del test" }),
        el(
          "div",
          { class: "flex flex-wrap gap-1 rounded border border-slate-200 bg-white p-1 dark:border-slate-800" },
          buildTab("all", "Todas", report.total),
          buildTab("correct", "Aciertos", report.correct),
          buildTab("failed", "Fallos", report.total - report.correct),
        ),
      ),
      legend,
      el("div", { class: "mt-4" }, listHost),
    );

    R.mount(root, [hero, review]);
    renderList();

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ringStroke.setAttribute("stroke-dashoffset", String(CIRCUMFERENCE * (1 - report.percentage / 100)));
      });
    });
  }

  global.IHFScreens = global.IHFScreens || {};
  global.IHFScreens.results = { mount: mount };
})(globalThis);
