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
  var starting = false;

  // Screen chunks: the first paint only pays for the setup screen, so the quiz,
  // the results, the statistics dialog and the PDF pipeline are fetched on the
  // first click that needs them. Each load is cached; a failure is retried by
  // the next click instead of leaving a rejected promise cached forever.
  var CHUNKS = {
    quiz: function () {
      return import("./lazy/quiz-flow.js");
    },
    results: function () {
      return import("./lazy/results-flow.js");
    },
    stats: function () {
      return import("./lazy/stats-flow.js");
    },
    pdfViewer: function () {
      return import("./lazy/pdf-viewer.js");
    },
  };
  var chunkLoads = {};

  function loadChunk(name) {
    if (!chunkLoads[name]) {
      chunkLoads[name] = CHUNKS[name]().catch(function (error) {
        delete chunkLoads[name];
        throw error;
      });
    }
    return chunkLoads[name];
  }

  function screenNode(id) {
    return document.getElementById(id);
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
            loadChunk("stats")
              .then(function () {
                if (!Screens.stats) return;
                Screens.stats.open({
                  onCleared: function () {
                    if (button.parentNode) button.parentNode.removeChild(button);
                  },
                });
              })
              .catch(function () {
                R.toast("No se pudieron cargar las estadísticas. Vuelve a intentarlo.");
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
    // The question dataset is a separate chunk: fetch it before the attempt can
    // be built, so the first paint never pays for the 330 KB catalogue.
    D.load()
      .then(function () {
        launchQuiz(D.pool(config.topics), config.size, Stats ? Stats.MODES.full : "full");
      })
      .catch(function () {
        R.toast("No se pudo cargar el catálogo de preguntas. Revisa tu conexión y vuelve a intentarlo.");
      });
  }

  // One mount for both paths (a fresh test and the retry of the misses) so the
  // attempt is recorded in a single place and the two cannot drift apart.
  function launchQuiz(pool, size, mode) {
    if (starting) return;
    starting = true;
    loadChunk("quiz")
      .then(function () {
        starting = false;
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
      })
      .catch(function () {
        starting = false;
        R.toast("No se pudo cargar el test. Revisa tu conexión y vuelve a intentarlo.");
      });
  }

  function recordAttempt(report, mode) {
    if (!Stats) return;
    Stats.record(Stats.toAttempt(report, mode));
  }

  function showResults() {
    renderHeaderStatsButton();
    loadChunk("results")
      .then(function () {
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
      })
      .catch(function () {
        R.toast("No se pudieron cargar los resultados. Revisa tu conexión y vuelve a intentarlo.");
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

  // Every PDF link in the app (rule chips, "Ver en las Reglas de Juego", the
  // footer sources) opens in the in-app viewer instead of a new tab. Modified
  // clicks and middle clicks keep the browser's behaviour.
  function interceptPdfLinks() {
    document.addEventListener("click", function (event) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var target = event.target;
      var link = target && target.closest ? target.closest("a[href]") : null;
      if (!link) return;
      // Inside a dialog (the viewer's own "Abrir en pestaña") the browser wins.
      if (link.closest('[role="dialog"]')) return;
      var href = link.getAttribute("href") || "";
      if (!/\.pdf(?:[?#]|$)/i.test(href)) return;
      event.preventDefault();
      loadChunk("pdfViewer")
        .then(function () {
          global.IHFPdfModal.open({ url: href, title: link.textContent.trim() });
        })
        .catch(function () {
          // The viewer never arrived (offline, blocked chunk): fall back to the
          // plain navigation the link always had.
          global.location.href = href;
        });
    });
  }

  function boot() {
    if (!global.IHFData || !global.IHFScreens || !global.IHFScreens.setup || !global.IHFQuiz) {
      renderFatal("Falta data/questions.js o algún módulo de scripts/. Recarga la página.");
      return;
    }
    showSetup();
    interceptPdfLinks();

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
