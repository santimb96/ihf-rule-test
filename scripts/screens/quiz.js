/**
 * Quiz screen: one question at a time with multi-select options, a
 * collapsible hint, jump pills, progress bar and guarded exit/finish flows.
 */
(function (global) {
  "use strict";

  var R = global.IHFRender;
  var D = global.IHFData;
  var Hint = global.IHFHint;
  var el = R.el;

  function openConfirm(opts) {
    var overlay;
    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    overlay = el(
      "div",
      {
        class: "fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in",
        on: {
          click: function (e) {
            if (e.target === overlay) close();
          },
        },
      },
      el(
        "div",
        { class: "w-full max-w-sm rounded-3xl bg-white p-6 shadow-lift animate-pop-in", role: "dialog", "aria-modal": "true" },
        el("h3", { class: "font-display text-lg font-semibold text-ink", text: opts.title }),
        el("p", { class: "mt-2 text-sm leading-relaxed text-slate-600", text: opts.message }),
        el(
          "div",
          { class: "mt-5 flex justify-end gap-3" },
          el("button", {
            type: "button",
            class: "rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50",
            on: { click: close },
            text: opts.cancelText || "Cancelar",
          }),
          el("button", {
            type: "button",
            class:
              "rounded-xl px-4 py-2 text-sm font-semibold text-white transition " +
              (opts.danger ? "bg-rose-600 hover:bg-rose-500" : "bg-brand-600 hover:bg-brand-500"),
            on: {
              click: function () {
                close();
                opts.onConfirm();
              },
            },
            text: opts.confirmText,
          }),
        ),
      ),
    );
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKey);
  }

  function mount(root, ctx) {
    var quiz = ctx.quiz;
    var total = quiz.items.length;
    var index = 0;
    var startTime = Date.now();
    var timerInterval = null;

    var PILL_CLASS = "h-11 min-w-[44px] rounded-lg px-2 text-xs font-bold transition sm:h-8 sm:min-w-[32px]";
    var fill = el("div", { class: "progress-fill h-full rounded-full", style: { width: "0%" } });
    var counter = el("span", { class: "font-display text-sm font-semibold text-ink" });
    var answeredLabel = el("span", { class: "text-xs font-medium text-slate-500" });
    var timerTextSpan = el("span", { class: "font-display font-semibold tracking-normal text-xs" });
    var timerLabel = el("span", { 
      class: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200",
      kids: [
        R.icon("clock", "h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400"),
        timerTextSpan
      ]
    });
    var pills = el("div", { class: "flex flex-wrap gap-1.5" });
    var cardHost = el("div", { class: "mt-4" });
    var prevButton;
    var nextButton;
    var nextLabel;
    var pillNodes = [];
    var pillClasses = [];
    var pillCurrent = [];

    function updateTimer() {
      var elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed > 3599) elapsed = 3599; // Cap at 59:59
      var mins = Math.floor(elapsed / 60);
      var secs = elapsed % 60;
      var text = (mins < 10 ? "0" + mins : mins) + ":" + (secs < 10 ? "0" + secs : secs);
      if (timerTextSpan.textContent !== text) timerTextSpan.textContent = text;
    }

    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();

    function clearTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }

    function answeredCount() {
      return quiz.answeredCount();
    }

    // Writes only what changed so option clicks do not touch the whole chrome.
    function setText(node, value) {
      if (node.textContent !== value) node.textContent = value;
    }

    function pillClass(current, done) {
      return (
        PILL_CLASS +
        (current
          ? " bg-brand-600 text-white shadow-card"
          : done
            ? " bg-brand-100 text-brand-700 hover:bg-brand-200"
            : " bg-slate-100 text-slate-500 hover:bg-slate-200")
      );
    }

    function syncChrome() {
      var width = ((index + 1) / total) * 100 + "%";
      if (fill.style.width !== width) fill.style.width = width;
      setText(counter, "Pregunta " + (index + 1) + " / " + total);
      setText(answeredLabel, answeredCount() + " de " + total + " respondidas");
      pillNodes.forEach(function (pill, i) {
        var current = i === index;
        var cls = pillClass(current, quiz.selected(i).length > 0);
        if (pillClasses[i] !== cls) {
          pillClasses[i] = cls;
          pill.className = cls;
        }
        var aria = current ? "step" : "false";
        if (pillCurrent[i] !== aria) {
          pillCurrent[i] = aria;
          pill.setAttribute("aria-current", aria);
        }
      });
      var atStart = index === 0;
      if (prevButton && prevButton.disabled !== atStart) prevButton.disabled = atStart;
      setText(nextLabel, index === total - 1 ? "Finalizar test" : "Siguiente");
      nextButton.classList.toggle("from-emerald-500", index === total - 1);
      nextButton.classList.toggle("to-emerald-400", index === total - 1);
      nextButton.classList.toggle("from-brand-600", index !== total - 1);
      nextButton.classList.toggle("to-brand-500", index !== total - 1);
    }

    function optionClass(on) {
      return (
        "option flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left " +
        (on
          ? "border-brand-500 bg-brand-50/80 shadow-card ring-1 ring-brand-500 dark:border-brand-500 dark:bg-brand-900/40"
          : "border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60")
      );
    }

    function checkBoxClass(on) {
      return (
        "grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition " +
        (on ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-transparent dark:border-slate-600")
      );
    }

    function letterClass(on) {
      return (
        "option-letter grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold transition " +
        (on
          ? "bg-brand-600 text-white"
          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200")
      );
    }

    function renderQuestion() {
      var question = quiz.items[index];
      var letters = quiz.selected(index);
      var hint = Hint.create(question);

      var optionNodes = question.options.map(function (opt) {
        var boxIcon = R.icon("check", "h-3.5 w-3.5 text-white");
        boxIcon.style.opacity = letters.includes(opt.letter) ? "1" : "0";
        var box = el("span", { class: checkBoxClass(letters.includes(opt.letter)), kids: [boxIcon] });
        var node = el(
          "button",
          {
            type: "button",
            role: "checkbox",
            "aria-checked": String(letters.includes(opt.letter)),
            "data-letter": opt.letter,
            class: optionClass(letters.includes(opt.letter)),
            on: {
              click: function () {
                var current = quiz.selected(index);
                var next = current.includes(opt.letter)
                  ? current.filter(function (l) {
                      return l !== opt.letter;
                    })
                  : current.concat(opt.letter).sort();
                quiz.select(index, next);
                var on = next.includes(opt.letter);
                node.setAttribute("aria-checked", String(on));
                node.className = optionClass(on);
                node.querySelector(".option-letter").className = letterClass(on);
                box.className = checkBoxClass(on);
                boxIcon.style.opacity = on ? "1" : "0";
                syncChrome();
              },
            },
          },
          el("span", { class: letterClass(letters.includes(opt.letter)), text: opt.letter }),
          el("span", { class: "flex-1 text-sm leading-relaxed text-slate-700", text: opt.text }),
          box,
        );
        return node;
      });

      var card = el(
        "article",
        { class: "rounded-3xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6 animate-fade-up", "data-qid": question.id },
        el(
          "div",
          { class: "flex flex-wrap items-center justify-between gap-3" },
          el(
            "div",
            { class: "flex flex-wrap items-center gap-2" },
            el("span", {
              class: "rounded-lg bg-brand-600 px-2 py-1 font-display text-xs font-bold text-white",
              text: question.id,
            }),
            el("span", {
              class: "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600",
              text: D.topicLabel(question.topic),
            }),
          ),
          hint.button,
        ),
        el("h2", { id: "quiz-question", class: "mt-5 max-w-[70ch] text-base font-medium leading-relaxed text-ink sm:text-lg", text: question.text }),
        el("p", { class: "mt-3 text-xs font-medium text-slate-500", text: "Marca todas las respuestas correctas. Puede haber más de una." }),
        el("div", { class: "mt-3 space-y-3", role: "group", "aria-labelledby": "quiz-question", kids: optionNodes }),
        hint.panel,
      );

      R.mount(cardHost, card);
      syncChrome();
    }

    function go(nextIndex) {
      if (nextIndex < 0 || nextIndex >= total) return;
      index = nextIndex;
      renderQuestion();
    }

    function finish() {
      clearTimer();
      var pending = total - answeredCount();
      if (pending > 0) {
        var unansweredList = [];
        for (var i = 0; i < total; i++) {
          if (quiz.selected(i).length === 0) {
            unansweredList.push(i + 1);
          }
        }
        var listStr = unansweredList.slice(0, 5).join(", ") + (unansweredList.length > 5 ? "..." : "");
        openConfirm({
          title: "Faltan preguntas por responder",
          message: "Tienes " + pending + (pending === 1 ? " pregunta sin responder" : " preguntas sin responder") + " (" + listStr + "). Puedes terminar igualmente, pero se contarán como falladas.",
          confirmText: "Terminar igualmente",
          danger: true,
          onConfirm: function () {
            ctx.onFinish(quiz.report());
          },
        });
        return;
      }
      ctx.onFinish(quiz.report());
    }

    function exit() {
      clearTimer();
      if (answeredCount() > 0) {
        openConfirm({
          title: "Salir del test",
          message: "Perderás las respuestas de este intento. ¿Quieres salir?",
          confirmText: "Salir",
          danger: true,
          onConfirm: function () {
            ctx.onExit();
          },
        });
        return;
      }
      ctx.onExit();
    }

    var topbar = el(
      "div",
      { class: "rounded-3xl border border-slate-200/80 bg-white p-4 shadow-card sm:p-5" },
      el(
        "div",
        { class: "flex flex-wrap items-center justify-between gap-3" },
        el(
          "button",
          {
            type: "button",
            class: "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-600",
            "data-action": "exit",
            on: { click: exit },
            kids: [R.icon("close", "h-4 w-4"), "Salir"],
          },
        ),
        el("div", { class: "flex items-center gap-3" }, timerLabel, counter),
        answeredLabel,
      ),
      el("div", { class: "mt-3 h-2 overflow-hidden rounded-full bg-slate-100" }, fill),
      el("div", { class: "mt-3 flex items-center justify-between gap-3" }, pills),
    );

    pillNodes = quiz.items.map(function (question, i) {
      var pill = el("button", {
        type: "button",
        "data-pill": String(i + 1),
        "aria-label": "Ir a la pregunta " + (i + 1),
        class: PILL_CLASS,
        text: String(i + 1),
        title: "Pregunta " + (i + 1),
        on: {
          click: function () {
            go(i);
          },
        },
      });
      return pill;
    });
    pills.append.apply(pills, pillNodes);

    prevButton = el(
      "button",
      {
        type: "button",
        "data-action": "prev",
        class: "inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 active:translate-y-px disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white dark:disabled:text-slate-500",
        on: {
          click: function () {
            go(index - 1);
          },
        },
        kids: [R.icon("left", "h-4 w-4"), "Anterior"],
      },
    );

    nextLabel = el("span", { text: "Siguiente" });
    nextButton = el(
      "button",
      {
        type: "button",
        "data-action": "next",
        class:
          "group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lift transition hover:-translate-y-0.5 active:translate-y-0 active:brightness-95",
        on: {
          click: function () {
            if (index === total - 1) finish();
            else go(index + 1);
          },
        },
        kids: [nextLabel, R.icon("right", "h-4 w-4 transition-transform group-hover:translate-x-0.5")],
      },
    );

    var nav = el(
      "div",
      { class: "quiz-nav sticky bottom-3 z-30 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-lift backdrop-blur dark:border-slate-700 dark:bg-slate-900/95" },
      prevButton,
      nextButton,
    );

    R.mount(root, [topbar, cardHost, nav]);
    renderQuestion();
  }

  global.IHFScreens = global.IHFScreens || {};
  global.IHFScreens.quiz = { mount: mount };
})(globalThis);
