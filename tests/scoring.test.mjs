import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { passes, percentage, requiredCorrect, questionPoints } = require("../scripts/scoring.js");

test("percentage is computed over the number of possible answers, two decimals", () => {
  assert.equal(percentage(5, 6), 83.33);
  assert.equal(percentage(4, 6), 66.67);
  assert.equal(percentage(7, 9), 77.78);
  assert.equal(percentage(6, 9), 66.67);
  assert.equal(percentage(15, 20), 75);
  assert.equal(percentage(0, 6), 0);
  assert.equal(percentage(3, 0), 0);
});

test("pass mark is 75% of the possible answers", () => {
  assert.equal(passes(5, 6), true); // 83.33%
  assert.equal(passes(4, 6), false); // 66.67%
  assert.equal(passes(7, 9), true); // 77.78%
  assert.equal(passes(6, 9), false); // 66.67%
  assert.equal(passes(15, 20), true); // exactly 75%
  assert.equal(passes(14, 20), false);
  assert.equal(passes(0, 5), false);
});

test("requiredCorrect reports the minimum answers needed to pass", () => {
  assert.equal(requiredCorrect(6), 5); // 5/6 = 83.33%
  assert.equal(requiredCorrect(9), 7); // 7/9 = 77.78%
  assert.equal(requiredCorrect(5), 4);
  assert.equal(requiredCorrect(20), 15);
  assert.equal(requiredCorrect(30), 23);
});

test("questionPoints counts correct answers and voids any wrong selection", () => {
  assert.equal(questionPoints(["a", "b"], ["a", "b"]), 2);
  assert.equal(questionPoints(["b", "a"], ["a", "b"]), 2);
  assert.equal(questionPoints(["a"], ["a", "b"]), 1); // partial, no wrong option
  assert.equal(questionPoints([], ["a", "b"]), 0); // unanswered
  assert.equal(questionPoints(["a", "c"], ["a", "b"]), 0); // wrong option voids it
  assert.equal(questionPoints(["a", "b", "c"], ["a", "b"]), 0); // superset
});
