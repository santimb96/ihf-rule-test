import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createQuiz } = require("../scripts/quiz.js");

const pool = Array.from({ length: 40 }, (_, i) => ({
  id: `1.${i + 1}`,
  topic: "1",
  text: `Question ${i + 1}`,
  options: [
    { letter: "a", text: "Option A" },
    { letter: "b", text: "Option B" },
  ],
  answer: [i % 3 === 0 ? "a" : "b"],
  rules: "1:1",
}));

test("createQuiz picks the requested number of distinct questions", () => {
  const quiz = createQuiz({ pool, size: 10, rng: () => 0.5 });
  assert.equal(quiz.items.length, 10);
  assert.equal(new Set(quiz.items.map((q) => q.id)).size, 10);
  for (const item of quiz.items) assert.ok(pool.includes(item));
});

test("createQuiz adapts size when pool is smaller", () => {
  const quiz = createQuiz({ pool: pool.slice(0, 4), size: 5 });
  assert.equal(quiz.items.length, 4);
  for (const item of quiz.items) assert.ok(pool.includes(item));
});

test("answers are stored per question and grading produces a report", () => {
  const quiz = createQuiz({ pool, size: 5, rng: () => 0 });
  const [first, second, third] = quiz.items;
  quiz.select(0, first.answer);
  quiz.select(1, second.answer.concat("a").slice(0, 2)); // wrong superset
  quiz.select(2, []);
  assert.deepEqual(quiz.selected(0), first.answer);
  assert.equal(quiz.answeredCount(), 2);

  const report = quiz.report();
  assert.equal(report.total, 5);
  assert.equal(report.results.length, 5);
  assert.equal(typeof report.correct, "number");
  assert.equal(report.results[0].correct, true);
  assert.equal(report.results[1].correct, false);
  assert.equal(report.results[2].correct, false); // unanswered
  assert.equal(report.results[0].points, 1);
  assert.equal(report.results[1].points, 0); // wrong option voids the question
});

test("report exposes pass state using the 75% rule", () => {
  const quiz = createQuiz({ pool: pool.slice(0, 5), size: 5, rng: () => 0 });
  quiz.items.forEach((q, i) => {
    if (i < 4) quiz.select(i, q.answer); // 4 of 5 questions, one answer each
  });
  const report = quiz.report();
  assert.equal(report.correct, 4);
  assert.equal(report.score, 4);
  assert.equal(report.totalAnswers, 5);
  assert.equal(report.passed, true);
  assert.equal(report.percentage, 80);
  assert.equal(report.required, 4);
});

test("the score counts answers, not questions", () => {
  const multi = [
    {
      id: "1.1",
      topic: "1",
      text: "Multi answer",
      options: [
        { letter: "a", text: "Option A" },
        { letter: "b", text: "Option B" },
        { letter: "c", text: "Option C" },
      ],
      answer: ["a", "b"],
      rules: "1:1",
    },
    {
      id: "1.2",
      topic: "1",
      text: "Single answer",
      options: [
        { letter: "a", text: "Option A" },
        { letter: "b", text: "Option B" },
      ],
      answer: ["a"],
      rules: "1:2",
    },
  ];
  const quiz = createQuiz({ pool: multi, size: 2, rng: () => 0.5 });
  const multiIndex = quiz.items.findIndex((q) => q.answer.length === 2);
  const singleIndex = quiz.items.findIndex((q) => q.answer.length === 1);
  quiz.select(multiIndex, [quiz.items[multiIndex].answer[0]]); // 1 of 2 answers
  quiz.select(singleIndex, quiz.items[singleIndex].answer); // 1 of 1 answer

  const report = quiz.report();
  assert.equal(report.total, 2); // questions
  assert.equal(report.totalAnswers, 3); // possible answers
  assert.equal(report.score, 2); // answers hit
  assert.equal(report.percentage, 66.67);
  assert.equal(report.passed, false);
  assert.equal(report.required, 3);
});
