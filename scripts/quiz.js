/**
 * Quiz engine: builds a randomized attempt over a question pool, tracks the
 * selected options per question and produces the final report used by both
 * the results screen and the PDF export.
 */
(function (global) {
  "use strict";

  var Scoring = global.IHFScoring;
  if (!Scoring && typeof require === "function") Scoring = require("./scoring.js");

  function defaultRng() {
    return Math.random();
  }

  /** Fisher-Yates shuffle so a fixed rng makes attempts reproducible in tests. */
  function shuffle(items, rng) {
    var out = items.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function createQuiz(options) {
    var pool = options.pool || [];
    var size = options.size;
    var rng = options.rng || defaultRng;

    if (pool.length < size) {
      throw new Error("pool has " + pool.length + " questions, " + size + " requested");
    }

    var items = shuffle(pool, rng).slice(0, size);
    var selected = items.map(function () {
      return [];
    });

    return {
      items: items,

      select: function (index, letters) {
        selected[index] = letters.slice();
      },

      selected: function (index) {
        return selected[index].slice();
      },

      answeredCount: function () {
        return selected.filter(function (s) {
          return s.length > 0;
        }).length;
      },

      report: function () {
        var score = 0;
        var totalAnswers = 0;
        var results = items.map(function (question, index) {
          var picked = selected[index];
          var points = Scoring.questionPoints(picked, question.answer);
          score += points;
          totalAnswers += question.answer.length;
          return {
            question: question,
            selected: picked.slice(),
            points: points,
            correct: points === question.answer.length,
          };
        });
        var correct = results.filter(function (r) {
          return r.correct;
        }).length;
        return {
          total: items.length,
          totalAnswers: totalAnswers,
          score: score,
          correct: correct,
          results: results,
          percentage: Scoring.percentage(score, totalAnswers),
          passed: Scoring.passes(score, totalAnswers),
          required: Scoring.requiredCorrect(totalAnswers),
        };
      },
    };
  }

  var api = { createQuiz: createQuiz, shuffle: shuffle };
  global.IHFQuiz = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
