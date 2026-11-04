/**
 * Entry point: wires the three screens, owns the attempt lifecycle
 * (setup -> quiz -> results -> PDF/retry/new) and the header statistics.
 */
(function (global) {
  "use strict";

  var R = global.IHFRender;
  var D = global.IHFData;
  var Screens = global.IHFScreens;

  var state = { config: null, quiz: null, report: null };

  function screenNode(id) {
    return document.getElementById(id);
  }

  function renderHeaderStats() {
    var host = document.getElementById("header-stats");
    [
      D.meta.questionCount + " preguntas",
      D.topics().length + " temas",
      "Aprobado ≥75%",
    ].forEach(function (text) {
      R.append(
        host,
        R.el("span", {
          class: "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600",
          text: text,
        }),
      );
    });
  }

  function showSetup() {
    R.showScreen("screen-setup");
    Screens.setup.mount(screenNode("screen-setup"), {
      onStart: function (config) {
        state.config = config;
        startQuiz(config);
      },
    });
  }

  function startQuiz(config) {
    var pool = D.pool(config.topics);
    state.quiz = global.IHFQuiz.createQuiz({ pool: pool, size: config.size });
    R.showScreen("screen-quiz");
    Screens.quiz.mount(screenNode("screen-quiz"), {
      quiz: state.quiz,
      onFinish: function (report) {
        state.report = report;
        showResults();
      },
      onExit: showSetup,
    });
  }

  function showResults() {
    R.showScreen("screen-results");
    Screens.results.mount(screenNode("screen-results"), {
      report: state.report,
      config: state.config,
      onDownload: function () {
        var name = global.IHFPdf.generate(state.report, state.config);
        if (name) R.toast("PDF generado: " + name);
      },
      onRetry: function () {
        startQuiz(state.config);
      },
      onNew: showSetup,
    });
  }

  function renderFatal(message) {
    R.mount(
      screenNode("screen-setup"),
      R.el(
        "div",
        { class: "rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-card" },
        R.el("h1", { class: "font-display text-xl font-semibold text-rose-700", text: "No se pudo cargar el catálogo" }),
        R.el("p", { class: "mt-2 text-sm text-rose-600", text: message }),
      ),
    );
  }

  function boot() {
    if (!global.IHFData || !global.IHFScreens || !global.IHFQuiz) {
      renderFatal("Falta data/questions.js o algún módulo de scripts/. Recarga la página.");
      return;
    }
    renderHeaderStats();
    showSetup();
  }

  document.addEventListener("DOMContentLoaded", boot);
})(globalThis);
