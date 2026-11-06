/**
 * Local statistics: durable, per-browser attempt history in localStorage plus
 * the pure aggregations the statistics dialog reads. Nothing here touches the
 * DOM, and every storage access is guarded, so a missing, full or blocked
 * localStorage degrades to "no history" instead of breaking the app.
 */
(function (global) {
  "use strict";

  var Scoring = global.IHFScoring;
  if (!Scoring && typeof require === "function") Scoring = require("./scoring.js");

  var KEY = "ihf.stats.v1";
  var SCHEMA_VERSION = 1;
  var MAX_ATTEMPTS = 200;
  var MODES = { full: "full", retry: "retry" };
  var STATUSES = ["correct", "partial", "wrong", "unanswered"];
  var OTHER_RULE = "otros";
  // A rule needs a few sightings before its accuracy means anything.
  var MIN_RULE_SEEN = 3;
  // Below this delta a change is noise, not a trend.
  var TREND_EPSILON = 0.5;

  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  function average(values) {
    if (!values.length) return 0;
    var total = 0;
    for (var i = 0; i < values.length; i++) total += values[i];
    return total / values.length;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function defaultStorage() {
    try {
      return global.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function empty() {
    return { v: SCHEMA_VERSION, attempts: [] };
  }

  function sanitizeItem(item) {
    if (!item || typeof item !== "object") return null;
    if (typeof item.q !== "string" || !item.q) return null;
    if (STATUSES.indexOf(item.s) === -1) return null;
    return {
      q: item.q,
      s: item.s,
      p: isFiniteNumber(item.p) ? item.p : 0,
      a: isFiniteNumber(item.a) ? item.a : 0,
    };
  }

  function sanitizeAttempt(attempt) {
    if (!attempt || typeof attempt !== "object") return null;
    if (!isFiniteNumber(attempt.at) || !isFiniteNumber(attempt.pct)) return null;
    if (!Array.isArray(attempt.items)) return null;
    var items = attempt.items.map(sanitizeItem).filter(Boolean);
    return {
      at: attempt.at,
      mode: attempt.mode === MODES.retry ? MODES.retry : MODES.full,
      size: isFiniteNumber(attempt.size) ? attempt.size : items.length,
      elapsed: isFiniteNumber(attempt.elapsed) ? attempt.elapsed : 0,
      score: isFiniteNumber(attempt.score) ? attempt.score : 0,
      totalAnswers: isFiniteNumber(attempt.totalAnswers) ? attempt.totalAnswers : 0,
      pct: attempt.pct,
      passed: !!attempt.passed,
      items: items,
    };
  }

  /** Reads the stored history. Corrupt, foreign-version or blocked storage
   *  always yields an empty history instead of throwing. */
  function load(storage) {
    var store = arguments.length ? storage : defaultStorage();
    if (!store) return empty();
    var raw;
    try {
      raw = store.getItem(KEY);
    } catch (error) {
      return empty();
    }
    if (!raw) return empty();
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return empty();
    }
    if (!parsed || parsed.v !== SCHEMA_VERSION || !Array.isArray(parsed.attempts)) return empty();
    return {
      v: SCHEMA_VERSION,
      attempts: parsed.attempts.map(sanitizeAttempt).filter(Boolean),
    };
  }

  /** Writes the history; returns false when the browser refuses (quota,
   *  private mode) without throwing. */
  function save(state, storage) {
    var store = arguments.length > 1 ? storage : defaultStorage();
    if (!store) return false;
    try {
      store.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      return false;
    }
  }

  function appendAttempt(state, attempt) {
    var base = state && Array.isArray(state.attempts) ? state : empty();
    var attempts = base.attempts.concat([attempt]);
    if (attempts.length > MAX_ATTEMPTS) attempts = attempts.slice(attempts.length - MAX_ATTEMPTS);
    return { v: SCHEMA_VERSION, attempts: attempts };
  }

  function clear(storage) {
    var store = arguments.length ? storage : defaultStorage();
    if (!store) return false;
    try {
      store.removeItem(KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  /** Loads, appends and saves one attempt. `ok` reports the write only: the
   *  returned state is still useful to the caller when the write failed. */
  function record(attempt, storage) {
    var store = arguments.length > 1 ? storage : defaultStorage();
    var state = appendAttempt(load(store), attempt);
    return { ok: save(state, store), state: state };
  }

  function all(storage) {
    var state = arguments.length ? load(storage) : load();
    return state.attempts;
  }

  /** Turns a finished report into the compact record we persist. */
  function toAttempt(report, mode, now) {
    var items = (report.results || []).map(function (result) {
      var status = result.status;
      if (!status) status = Scoring.questionStatus(result.selected, result.question.answer);
      return {
        q: result.question.id,
        s: status,
        p: result.points,
        a: result.question.answer.length,
      };
    });
    return {
      at: isFiniteNumber(now) ? now : Date.now(),
      mode: mode === MODES.retry ? MODES.retry : MODES.full,
      size: report.total,
      elapsed: report.elapsedTime || 0,
      score: report.score,
      totalAnswers: report.totalAnswers,
      pct: report.percentage,
      passed: !!report.passed,
      items: items,
    };
  }

  function summary(attempts) {
    var counts = { correct: 0, partial: 0, wrong: 0, unanswered: 0 };
    var pcts = [];
    var passed = 0;
    var questions = 0;
    var score = 0;
    var totalAnswers = 0;

    attempts.forEach(function (attempt) {
      if (isFiniteNumber(attempt.pct)) pcts.push(attempt.pct);
      if (attempt.passed) passed += 1;
      score += attempt.score || 0;
      totalAnswers += attempt.totalAnswers || 0;
      (attempt.items || []).forEach(function (item) {
        questions += 1;
        if (counts[item.s] !== undefined) counts[item.s] += 1;
      });
    });

    return {
      attempts: attempts.length,
      questions: questions,
      counts: counts,
      averagePct: round2(average(pcts)),
      bestPct: pcts.length ? Math.max.apply(null, pcts) : 0,
      lastPct: pcts.length ? pcts[pcts.length - 1] : 0,
      passed: passed,
      failed: attempts.length - passed,
      score: score,
      totalAnswers: totalAnswers,
    };
  }

  /** Improved / worsened / stable by comparing the recent half of the full
   *  attempts against the previous half. Retry sessions are excluded: they
   *  re-run the questions that were already missed and would bias the trend. */
  function trend(attempts) {
    var full = attempts.filter(function (attempt) {
      return attempt.mode !== MODES.retry && isFiniteNumber(attempt.pct);
    });
    if (full.length < 2) {
      return {
        direction: "insufficient",
        delta: 0,
        previousPct: null,
        recentPct: null,
        previousCount: 0,
        recentCount: full.length,
      };
    }
    var recentCount = Math.ceil(full.length / 2);
    var previousCount = full.length - recentCount;
    var previousPct = round2(
      average(
        full.slice(0, previousCount).map(function (attempt) {
          return attempt.pct;
        }),
      ),
    );
    var recentPct = round2(
      average(
        full.slice(previousCount).map(function (attempt) {
          return attempt.pct;
        }),
      ),
    );
    var delta = round2(recentPct - previousPct);
    var direction = Math.abs(delta) < TREND_EPSILON ? "stable" : delta > 0 ? "improved" : "worsened";
    return {
      direction: direction,
      delta: delta,
      previousPct: previousPct,
      recentPct: recentPct,
      previousCount: previousCount,
      recentCount: recentCount,
    };
  }

  function primaryRule(question) {
    var raw = question && question.rules ? String(question.rules).split(",")[0].trim() : "";
    var match = raw.match(/^(\d{1,2})[:.]/);
    return match ? match[1] : OTHER_RULE;
  }

  function ruleLabel(key) {
    return key === OTHER_RULE ? "Otros" : "Regla " + key;
  }

  /** Groups every answered question by its primary rule, with accuracy over
   *  possible answers (the same denominator the score uses). */
  function byRule(attempts, questionsById) {
    var groups = {};
    var order = [];

    attempts.forEach(function (attempt) {
      (attempt.items || []).forEach(function (item) {
        var key = primaryRule(questionsById && questionsById[item.q]);
        if (!groups[key]) {
          groups[key] = {
            rule: key,
            label: ruleLabel(key),
            seen: 0,
            correct: 0,
            partial: 0,
            wrong: 0,
            unanswered: 0,
            score: 0,
            totalAnswers: 0,
            accuracy: 0,
          };
          order.push(key);
        }
        var group = groups[key];
        group.seen += 1;
        if (group[item.s] !== undefined) group[item.s] += 1;
        group.score += item.p || 0;
        group.totalAnswers += item.a || 0;
      });
    });

    var rules = order.map(function (key) {
      var group = groups[key];
      group.accuracy = group.totalAnswers ? round2((group.score / group.totalAnswers) * 100) : 0;
      return group;
    });

    rules.sort(function (a, b) {
      if (b.seen !== a.seen) return b.seen - a.seen;
      if (a.rule === OTHER_RULE) return 1;
      if (b.rule === OTHER_RULE) return -1;
      return Number(a.rule) - Number(b.rule);
    });

    var weakest = null;
    rules.forEach(function (group) {
      if (group.rule === OTHER_RULE || group.seen < MIN_RULE_SEEN) return;
      if (!weakest || group.accuracy < weakest.accuracy) weakest = group;
    });

    return {
      rules: rules,
      mostPracticed: rules.length ? rules[0] : null,
      weakest: weakest,
    };
  }

  function exportJson(attempts, now) {
    return JSON.stringify(
      {
        v: SCHEMA_VERSION,
        exportedAt: new Date(isFiniteNumber(now) ? now : Date.now()).toISOString(),
        attempts: attempts,
      },
      null,
      2,
    );
  }

  var api = {
    KEY: KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    MAX_ATTEMPTS: MAX_ATTEMPTS,
    MODES: MODES,
    MIN_RULE_SEEN: MIN_RULE_SEEN,
    empty: empty,
    load: load,
    save: save,
    appendAttempt: appendAttempt,
    clear: clear,
    record: record,
    all: all,
    toAttempt: toAttempt,
    summary: summary,
    trend: trend,
    primaryRule: primaryRule,
    ruleLabel: ruleLabel,
    byRule: byRule,
    exportJson: exportJson,
  };

  global.IHFStats = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
