/**
 * Entry point: wires the three screens and owns the attempt lifecycle
 * (setup -> quiz -> results -> PDF/retry/new).
 */
(function (global) {
  "use strict";

  var R = global.IHFRender;
  var D = global.IHFData;
  var Stats = global.IHFStats;
  var Screens = global.IHFScreens;

  var state = { config: null, quiz: null, report: null, startTime: null, elapsedTime: 0 };

  function screenNode(id) {
    return document.getElementById(id);
  }

  function renderHeaderStats() {
    var host = document.getElementById("header-stats");
    if (!host) return;
    [
      D.meta.questionCount + " preguntas",
      D.topics().length + " temas",
      "Aprobado ≥ 75%",
    ].forEach(function (text) {
      R.append(
        host,
        R.el("span", {
          class: "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300",
          text: text,
        }),
      );
    });
  }

  // The progress entry point lives in the header: it is global to the three
  // screens and does not compete with the "Comenzar test" decision. It only
  // exists once this browser holds at least one attempt.
  function renderHeaderStatsButton() {
    var host = document.getElementById("header-actions");
    if (!host) return;
    var existing = document.getElementById("stats-toggle");
    var hasHistory = !!(Stats && Stats.all().length);
    if (!hasHistory) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if (existing) return;

    var button = R.el(
      "button",
      {
        type: "button",
        id: "stats-toggle",
        "data-action": "stats",
        "aria-label": "Mis estadísticas",
        class:
          "inline-flex h-11 items-center justify-center gap-2 rounded border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-white",
        on: {
          click: function () {
            if (!Screens.stats) return;
            Screens.stats.open({
              onCleared: function () {
                if (button.parentNode) button.parentNode.removeChild(button);
              },
            });
          },
        },
        kids: [
          R.icon("chart", "h-5 w-5 shrink-0"),
          R.el("span", { class: "hidden sm:inline", text: "Estadísticas" }),
        ],
      },
    );
    host.appendChild(button);
  }

  function showSetup() {
    renderHeaderStatsButton();
    R.showScreen("screen-setup");
    Screens.setup.mount(screenNode("screen-setup"), {
      onStart: function (config) {
        state.config = config;
        startQuiz(config);
      },
    });
  }

  function startQuiz(config) {
    launchQuiz(D.pool(config.topics), config.size, Stats ? Stats.MODES.full : "full");
  }

  // One mount for both paths (a fresh test and the retry of the misses) so the
  // attempt is recorded in a single place and the two cannot drift apart.
  function launchQuiz(pool, size, mode) {
    state.quiz = global.IHFQuiz.createQuiz({ pool: pool, size: size });
    state.startTime = Date.now();
    state.elapsedTime = 0;
    R.showScreen("screen-quiz");
    Screens.quiz.mount(screenNode("screen-quiz"), {
      quiz: state.quiz,
      onFinish: function (report) {
        state.elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
        report.elapsedTime = state.elapsedTime;
        state.report = report;
        recordAttempt(report, mode);
        showResults();
      },
      onExit: showSetup,
    });
  }

  function recordAttempt(report, mode) {
    if (!Stats) return;
    Stats.record(Stats.toAttempt(report, mode));
  }

  function showResults() {
    renderHeaderStatsButton();
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
        launchQuiz(customPool, customSize, Stats ? Stats.MODES.retry : "retry");
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
        try {
          localStorage.setItem("theme", isDark ? "dark" : "light");
        } catch (error) {
          // Private mode or a full quota: the choice still applies to this page.
        }
        syncThemeLabel();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})(globalThis);
