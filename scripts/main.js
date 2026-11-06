/**
 * Entry point: wires the three screens and owns the attempt lifecycle
 * (setup -> quiz -> results -> PDF/retry/new).
 */
(function (global) {
  "use strict";

  var R = global.IHFRender;
  var D = global.IHFData;
  var Screens = global.IHFScreens;

  var state = { config: null, quiz: null, report: null, startTime: null, elapsedTime: 0 };

  function screenNode(id) {
    return document.getElementById(id);
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
    state.startTime = Date.now();
    state.elapsedTime = 0;
    R.showScreen("screen-quiz");
    Screens.quiz.mount(screenNode("screen-quiz"), {
      quiz: state.quiz,
      onFinish: function (report) {
        state.elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
        report.elapsedTime = state.elapsedTime;
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
      onDownload: function (done) {
        var finish = done || function () {};
        // jsPDF (366 KB) is fetched on demand so it stays out of the initial
        // payload; the namespace exposes the same `jsPDF` named export the
        // UMD global did, so pdf.js needs no change.
        import("jspdf")
          .then(function (mod) {
            global.jspdf = mod;
            return global.IHFPdf.generate(state.report, state.config);
          })
          .then(function (name) {
            if (name) R.toast("PDF generado: " + name);
            finish();
          })
          .catch(function () {
            R.toast("No se pudo generar el PDF. Vuelve a intentarlo.");
            finish();
          });
      },
      onRetry: function () {
        startQuiz(state.config);
      },
      onRetryFailed: function () {
        var failedQuestions = state.report.results
          .filter(function (r) { return !r.correct; })
          .map(function (r) { return r.question; });

        var customPool = failedQuestions;
        var customSize = Math.min(state.config.size, customPool.length);

        state.config = Object.assign({}, state.config, { size: customSize });
        var pool = customPool;
        state.quiz = global.IHFQuiz.createQuiz({ pool: pool, size: customSize });
        state.startTime = Date.now();
        state.elapsedTime = 0;
        R.showScreen("screen-quiz");
        Screens.quiz.mount(screenNode("screen-quiz"), {
          quiz: state.quiz,
          onFinish: function (report) {
            state.elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
            report.elapsedTime = state.elapsedTime;
            state.report = report;
            showResults();
          },
          onExit: showSetup,
        });
      },
      onNew: showSetup,
    });
  }

  function renderFatal(message) {
    R.mount(
      screenNode("screen-setup"),
      R.el(
        "div",
        { class: "rounded-md border border-rose-200 bg-rose-50 p-8 text-center shadow-card" },
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
    showSetup();

    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      var syncThemeLabel = function () {
        var isDark = document.documentElement.classList.contains("dark");
        toggle.setAttribute("aria-pressed", String(isDark));
        toggle.setAttribute("aria-label", isDark ? "Activar tema claro" : "Activar tema oscuro");
      };
      syncThemeLabel();
      toggle.addEventListener("click", function () {
        var isDark = document.documentElement.classList.toggle("dark");
        localStorage.setItem("theme", isDark ? "dark" : "light");
        syncThemeLabel();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})(globalThis);
