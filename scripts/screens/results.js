/**
 * Results screen: pass/fail hero with an animated score ring, action bar
 * (PDF, retry, new test) and a filterable per-question review with hints.
 */
(function (global) {
  "use strict";

  var R = global.IHFRender;
  var D = global.IHFData;
  var Hint = global.IHFHint;
  var el = R.el;

  var CIRCUMFERENCE = 2 * Math.PI * 54;

  function reviewCard(result) {
    var q = result.question;
    var hint = Hint.create(q);
    var unanswered = result.selected.length === 0;

    var status = result.correct
      ? { label: "Aceptada", icon: "check", tone: "bg-emerald-100 text-emerald-700", bar: "border-l-emerald-500" }
      : { label: unanswered ? "Sin responder" : "Fallada", icon: "x", tone: "bg-rose-100 text-rose-700", bar: "border-l-rose-500" };

    var optionRows = q.options.map(function (opt) {
      var isCorrect = q.answer.includes(opt.letter);
      var isWrongPick = result.selected.includes(opt.letter) && !isCorrect;
      var tone = isCorrect
        ? "border-emerald-200 bg-emerald-50/80"
        : isWrongPick
          ? "border-rose-200 bg-rose-50/80"
          : "border-slate-100 bg-slate-50/60";
      var badge = isCorrect
        ? "bg-emerald-600 text-white"
        : isWrongPick
          ? "bg-rose-600 text-white"
          : "bg-slate-200 text-slate-500";
      return el(
        "li",
        { class: "flex items-start gap-2.5 rounded-xl border px-3 py-2 " + tone },
        el("span", { class: "grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold " + badge, text: opt.letter }),
        el("span", { class: "flex-1 text-xs leading-relaxed " + (isCorrect || isWrongPick ? "text-slate-800" : "text-slate-500"), text: opt.text }),
        isCorrect
          ? R.icon("check", "mt-0.5 h-4 w-4 shrink-0 text-emerald-600")
          : isWrongPick
            ? R.icon("x", "mt-0.5 h-4 w-4 shrink-0 text-rose-600")
            : null,
      );
    });

    var answerLine = el(
      "p",
      { class: "mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-3 text-xs" },
      el("span", { class: "text-slate-500" }, [
        "Tu respuesta: ",
        el("span", { class: "font-semibold " + (unanswered ? "text-rose-600" : result.correct ? "text-emerald-700" : "text-rose-600"), text: unanswered ? "sin responder" : result.selected.join(", ") }),
      ]),
      el("span", { class: "text-slate-500" }, [
        "Respuesta correcta: ",
        el("span", { class: "font-semibold text-emerald-700", text: q.answer.join(", ") }),
      ]),
    );

    return el(
      "article",
      {
        class: "review-card rounded-2xl border border-l-4 border-slate-200 bg-white p-4 shadow-card " + status.bar,
      },
      el(
        "div",
        { class: "flex flex-wrap items-center justify-between gap-3" },
        el(
          "div",
          { class: "flex flex-wrap items-center gap-2" },
          el("span", { class: "grid h-7 w-7 place-items-center rounded-full " + status.tone, kids: [R.icon(status.icon, "h-4 w-4")] }),
          el("span", { class: "text-xs font-bold uppercase tracking-wide " + (result.correct ? "text-emerald-700" : "text-rose-700"), text: status.label }),
          el("span", { class: "rounded-md bg-brand-600 px-1.5 py-0.5 font-display text-[11px] font-bold text-white", text: q.id }),
          el("span", { class: "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600", text: D.topicLabel(q.topic) }),
        ),
        hint.button,
      ),
      el("p", { class: "mt-3 text-sm font-medium leading-relaxed text-ink", text: q.text }),
      el("ul", { class: "mt-3 space-y-1.5", kids: optionRows }),
      answerLine,
      hint.panel,
    );
  }

  function mount(root, ctx) {
    var report = ctx.report;
    var config = ctx.config;
    var filter = "all";

    var ringStroke = el("circle", {
      class: "ring-progress",
      cx: "60",
      cy: "60",
      r: "54",
      fill: "none",
      "stroke-width": "10",
      "stroke-linecap": "round",
      "stroke-dasharray": String(CIRCUMFERENCE),
      "stroke-dashoffset": String(CIRCUMFERENCE),
      stroke: report.passed ? "#059669" : "#e11d48",
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
          : [el("p", { class: "rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500", text: "No hay preguntas en esta categoría." })],
      );
      listHost.classList.toggle("is-long", nodes.length >= 12);
    }

    function tabClass(active) {
      return (
        "rounded-xl px-4 py-2 text-sm font-semibold transition " +
        (active ? "bg-brand-600 text-white shadow-card" : "text-slate-600 hover:bg-slate-100")
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

    var hero = el(
      "section",
      {
        class:
          "relative overflow-hidden rounded-3xl border border-l-4 p-6 shadow-lift sm:p-8 animate-fade-up " +
          (report.passed
            ? "border-emerald-200 border-l-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-teal-50/70"
            : "border-rose-200 border-l-rose-500 bg-gradient-to-br from-rose-50 via-white to-orange-50/60"),
      },
      el("div", {
        class: "pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-2xl " + (report.passed ? "bg-emerald-300/30" : "bg-rose-300/30"),
      }),
      el(
        "div",
        { class: "relative flex flex-col items-center gap-6 sm:flex-row sm:gap-8" },
        el(
          "div",
          { class: "relative h-36 w-36 shrink-0" },
          el(
            "svg",
            { viewBox: "0 0 120 120", class: "h-36 w-36 -rotate-90" },
            el("circle", { cx: "60", cy: "60", r: "54", fill: "none", stroke: "#e2e8f0", "stroke-width": "10" }),
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
          { class: "min-w-0 flex-1 text-center sm:text-left" },
          el("span", {
            class: "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider " + (report.passed ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"),
            kids: [R.icon(report.passed ? "check" : "x", "h-3.5 w-3.5"), report.passed ? "Aprobado" : "No aprobado"],
          }),
          el("h1", { class: "mt-3 font-display text-2xl font-bold text-ink text-balance sm:text-3xl", text: report.passed ? "¡Enhorabuena, has aprobado!" : "Esta vez no ha sido" }),
          el("p", { class: "mt-2 text-sm leading-relaxed text-slate-600" }, [
            "Has acertado ",
            el("strong", { class: "font-semibold text-ink", text: report.score + " de " + report.totalAnswers + " respuestas" }),
            report.passed
              ? " (" + report.percentage + "%), por encima del 75% exigido."
              : " (" + report.percentage + "%). Necesitabas " + report.required + " respuestas correctas para aprobar (75%).",
          ]),
          el(
            "div",
            { class: "mt-4 flex flex-wrap justify-center gap-2 sm:justify-start" },
            [config.size + " preguntas", topicSummary, "mín. " + report.required + " respuestas", new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })].map(function (text) {
              return el("span", { class: "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600", text: text });
            }),
          ),
        ),
        el(
          "div",
          { class: "flex w-full flex-col gap-2.5 sm:w-auto sm:shrink-0" },
          el(
            "button",
            {
              type: "button",
              class: "group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lift transition hover:-translate-y-0.5 active:translate-y-0 active:brightness-95",
              "data-action": "download",
              on: { click: ctx.onDownload },
              kids: [R.icon("download", "h-4 w-4"), "Descargar PDF"],
            },
          ),
          el(
            "button",
            {
              type: "button",
              class: "inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 active:translate-y-px",
              "data-action": "retry",
              on: { click: ctx.onRetry },
              kids: [R.icon("refresh", "h-4 w-4"), "Repetir test"],
            },
          ),
          el(
            "button",
            {
              type: "button",
              class: "inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 active:translate-y-px",
              "data-action": "new",
              on: { click: ctx.onNew },
              kids: [R.icon("grid", "h-4 w-4"), "Nuevo test"],
            },
          ),
        ),
      ),
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
          { class: "flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-card" },
          buildTab("all", "Todas", report.total),
          buildTab("correct", "Aciertos", report.correct),
          buildTab("failed", "Fallos", report.total - report.correct),
        ),
      ),
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
