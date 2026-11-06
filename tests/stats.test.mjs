import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Stats = require("../scripts/stats.js");
const { questionStatus, STATUS } = require("../scripts/scoring.js");

function fakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    dump() {
      return Object.fromEntries(map);
    },
  };
}

function attempt(pct, options = {}) {
  const items = options.items || [];
  return {
    at: options.at === undefined ? 0 : options.at,
    mode: options.mode || "full",
    size: items.length,
    elapsed: 0,
    score: options.score || 0,
    totalAnswers: options.totalAnswers || 0,
    pct,
    passed: pct >= 75,
    items,
  };
}

function item(id, status, points, answers) {
  return { q: id, s: status, p: points, a: answers };
}

test("questionStatus classifies the four outcomes from the shared scoring rule", () => {
  assert.equal(questionStatus([], ["a"]), STATUS.unanswered);
  assert.equal(questionStatus(["a"], ["a"]), STATUS.correct);
  assert.equal(questionStatus(["a"], ["a", "b"]), STATUS.partial);
  assert.equal(questionStatus(["a", "c"], ["a", "b"]), STATUS.wrong);
});

test("toAttempt keeps the compact record the dialog needs", () => {
  const report = {
    total: 2,
    score: 2,
    totalAnswers: 3,
    percentage: 66.67,
    passed: false,
    elapsedTime: 42,
    results: [
      { question: { id: "1.1", answer: ["a"] }, selected: ["a"], points: 1, status: STATUS.correct },
      { question: { id: "2.1", answer: ["a", "b"] }, selected: ["a"], points: 1, status: STATUS.partial },
    ],
  };

  const recorded = Stats.toAttempt(report, Stats.MODES.retry, 1700000000000);

  assert.equal(recorded.at, 1700000000000);
  assert.equal(recorded.mode, "retry");
  assert.equal(recorded.size, 2);
  assert.equal(recorded.elapsed, 42);
  assert.equal(recorded.pct, 66.67);
  assert.deepEqual(recorded.items, [
    { q: "1.1", s: "correct", p: 1, a: 1 },
    { q: "2.1", s: "partial", p: 1, a: 2 },
  ]);
});

test("toAttempt falls back to the shared classification when a report omits it", () => {
  const report = {
    total: 1,
    score: 0,
    totalAnswers: 1,
    percentage: 0,
    passed: false,
    results: [{ question: { id: "3.1", answer: ["b"] }, selected: [], points: 0 }],
  };

  assert.equal(Stats.toAttempt(report, "full", 0).items[0].s, "unanswered");
});

test("load returns an empty history for missing, corrupt and foreign-version data", () => {
  assert.deepEqual(Stats.load(fakeStorage()).attempts, []);
  assert.deepEqual(Stats.load(fakeStorage({ [Stats.KEY]: "{not json" })).attempts, []);
  assert.deepEqual(Stats.load(fakeStorage({ [Stats.KEY]: JSON.stringify({ v: 99, attempts: [] }) })).attempts, []);
  assert.deepEqual(Stats.load(fakeStorage({ [Stats.KEY]: JSON.stringify({ v: 1, attempts: "nope" }) })).attempts, []);
});

test("load drops invalid attempts and invalid items instead of the whole history", () => {
  const stored = {
    v: 1,
    attempts: [
      { at: 1, pct: 50, items: [item("1.1", "correct", 1, 1), { q: "", s: "correct" }] },
      { at: "yesterday", pct: 50, items: [] },
      { at: 2, pct: "half", items: [] },
    ],
  };
  const loaded = Stats.load(fakeStorage({ [Stats.KEY]: JSON.stringify(stored) }));

  assert.equal(loaded.attempts.length, 1);
  assert.equal(loaded.attempts[0].items.length, 1);
  assert.equal(loaded.attempts[0].mode, "full");
});

test("save reports a refused write instead of throwing", () => {
  const blocked = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {},
  };

  assert.equal(Stats.save(Stats.empty(), blocked), false);
  assert.equal(Stats.save(Stats.empty(), fakeStorage()), true);
});

test("record appends and keeps only the newest MAX_ATTEMPTS", () => {
  const storage = fakeStorage();
  for (let i = 0; i < Stats.MAX_ATTEMPTS + 5; i++) {
    Stats.record(attempt(i), storage);
  }
  const kept = Stats.all(storage);

  assert.equal(kept.length, Stats.MAX_ATTEMPTS);
  assert.equal(kept[0].pct, 5);
  assert.equal(kept[kept.length - 1].pct, Stats.MAX_ATTEMPTS + 4);
});

test("record still returns the appended state when the write fails", () => {
  const blocked = { getItem: () => null, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
  const result = Stats.record(attempt(80), blocked);

  assert.equal(result.ok, false);
  assert.equal(result.state.attempts.length, 1);
});

test("clear removes the stored history", () => {
  const storage = fakeStorage();
  Stats.record(attempt(80), storage);

  assert.equal(Stats.clear(storage), true);
  assert.equal(storage.getItem(Stats.KEY), null);
});

test("summary aggregates counts, averages and pass state", () => {
  const attempts = [
    attempt(50, { score: 1, totalAnswers: 2, items: [item("1.1", "correct", 1, 1), item("1.2", "wrong", 0, 1)] }),
    attempt(100, { score: 2, totalAnswers: 2, items: [item("1.3", "correct", 1, 1), item("1.4", "partial", 1, 2)] }),
  ];
  const result = Stats.summary(attempts);

  assert.equal(result.attempts, 2);
  assert.equal(result.questions, 4);
  assert.deepEqual(result.counts, { correct: 2, partial: 1, wrong: 1, unanswered: 0 });
  assert.equal(result.averagePct, 75);
  assert.equal(result.bestPct, 100);
  assert.equal(result.lastPct, 100);
  assert.equal(result.passed, 1);
  assert.equal(result.failed, 1);
});

test("trend needs two full attempts and compares the recent half against the previous half", () => {
  assert.equal(Stats.trend([]).direction, "insufficient");
  assert.equal(Stats.trend([attempt(90)]).direction, "insufficient");
  assert.equal(Stats.trend([attempt(40), attempt(80)]).direction, "improved");
  assert.equal(Stats.trend([attempt(40), attempt(80)]).delta, 40);
});

test("trend reports improved, worsened and stable over longer histories", () => {
  assert.equal(Stats.trend([attempt(50), attempt(60), attempt(70), attempt(80)]).direction, "improved");
  assert.equal(Stats.trend([attempt(80), attempt(70), attempt(50), attempt(40)]).direction, "worsened");
  assert.equal(Stats.trend([attempt(60), attempt(60), attempt(60), attempt(60)]).direction, "stable");
});

test("trend excludes retry sessions so reviewing misses cannot skew it", () => {
  const result = Stats.trend([
    attempt(50),
    attempt(50),
    attempt(10, { mode: "retry" }),
    attempt(10, { mode: "retry" }),
  ]);

  assert.equal(result.direction, "stable");
  assert.equal(result.recentCount, 1);
  assert.equal(result.previousCount, 1);
});

test("byRule groups by the primary rule and falls back to Otros", () => {
  const questionsById = {
    "1.1": { rules: "2:7, 12:1" },
    "1.2": { rules: "2:5" },
    "1.3": { rules: "Aclaración 3" },
    "1.4": { rules: "16:3a" },
  };
  const attempts = [
    attempt(50, {
      items: [
        item("1.1", "correct", 1, 1),
        item("1.2", "wrong", 0, 1),
        item("1.3", "partial", 1, 2),
        item("1.4", "correct", 1, 1),
      ],
    }),
    attempt(25, { items: [item("1.1", "wrong", 0, 1), item("1.4", "wrong", 0, 1)] }),
  ];

  const result = Stats.byRule(attempts, questionsById);
  const byLabel = Object.fromEntries(result.rules.map((group) => [group.label, group]));

  assert.equal(byLabel["Regla 2"].seen, 3);
  assert.equal(byLabel["Regla 2"].accuracy, 33.33); // (1 + 1) of (1 + 1 + 1)
  assert.equal(byLabel["Regla 16"].seen, 2);
  assert.equal(byLabel["Otros"].seen, 1);
  assert.equal(result.mostPracticed.label, "Regla 2");
  assert.equal(result.weakest.label, "Regla 2");
});

test("byRule keeps a rule out of the weak spot until it has enough sightings", () => {
  const questionsById = { "1.1": { rules: "2:7" }, "1.2": { rules: "7:1" } };
  const attempts = [
    attempt(0, { items: [item("1.1", "wrong", 0, 1)] }),
    attempt(100, { items: [item("1.2", "correct", 1, 1)] }),
  ];

  const result = Stats.byRule(attempts, questionsById);
  assert.equal(result.mostPracticed.label, "Regla 2");
  assert.equal(result.weakest, null);
});

test("primaryRule reads only the first cited rule", () => {
  assert.equal(Stats.primaryRule({ rules: "2:7, 12:1, 15:5b" }), "2");
  assert.equal(Stats.primaryRule({ rules: "16:3a" }), "16");
  assert.equal(Stats.primaryRule({ rules: "Aclaración 3" }), "otros");
  assert.equal(Stats.primaryRule({}), "otros");
  assert.equal(Stats.ruleLabel("7"), "Regla 7");
  assert.equal(Stats.ruleLabel("otros"), "Otros");
});

test("exportJson writes a versioned, parseable snapshot", () => {
  const parsed = JSON.parse(Stats.exportJson([attempt(80)], 1700000000000));

  assert.equal(parsed.v, 1);
  assert.equal(parsed.exportedAt, "2023-11-14T22:13:20.000Z");
  assert.equal(parsed.attempts.length, 1);
  assert.equal(parsed.attempts[0].pct, 80);
});
