/**
 * Scoring rules for the study platform: the score is counted over the number of
 * possible answers in the test (not over the number of questions), a test passes
 * with >= 75% of those answers, and a question only earns points when no wrong
 * option is selected (a partial selection of correct options still counts).
 */
(function (global) {
  "use strict";

  var PASS_RATIO = 0.75;
  var SUPPORTED_LENGTHS = [5, 10, 20, 30];

  function percentage(score, total) {
    if (!total) return 0;
    return Math.round((score / total) * 10000) / 100;
  }

  function passes(score, total) {
    if (!total) return false;
    return score / total >= PASS_RATIO;
  }

  function requiredCorrect(total) {
    return Math.ceil(PASS_RATIO * total);
  }

  function questionPoints(selected, answer) {
    if (!selected || !selected.length) return 0;
    var i;
    for (i = 0; i < selected.length; i++) {
      if (answer.indexOf(selected[i]) === -1) return 0;
    }
    var points = 0;
    for (i = 0; i < answer.length; i++) {
      if (selected.indexOf(answer[i]) !== -1) points++;
    }
    return points;
  }

  var api = {
    PASS_RATIO: PASS_RATIO,
    SUPPORTED_LENGTHS: SUPPORTED_LENGTHS,
    percentage: percentage,
    passes: passes,
    requiredCorrect: requiredCorrect,
    questionPoints: questionPoints,
  };

  global.IHFScoring = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
