import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const questionsUrl = new URL("../data/questions.js", import.meta.url);
const dataUrl = new URL("../scripts/data.js", import.meta.url);

(0, eval)(readFileSync(questionsUrl, "utf8"));
const full = globalThis.IHF_DATA;
const counts = {};
full.questions.forEach((q) => {
  counts[q.topic] = (counts[q.topic] || 0) + 1;
});

// Reproduce what the production entry does: the metadata ships with the first
// paint and the question dataset arrives later, only when a test starts.
delete globalThis.IHF_DATA;
globalThis.IHF_META = { meta: full.meta, topics: full.topics, counts: counts };
(0, eval)(readFileSync(dataUrl, "utf8"));
const D = globalThis.IHFData;

test("the setup screen can size the pool from the metadata alone", () => {
  const allTopics = full.topics.map((t) => t.id);
  assert.equal(D.poolSize(allTopics), full.questions.length);
  assert.equal(
    D.poolSize(["2"]),
    full.questions.filter((q) => q.topic === "2").length,
  );
  assert.equal(D.poolSize([]), 0);
});

test("labels and counts come from the metadata, not the dataset", () => {
  assert.equal(D.meta.questionCount, full.meta.questionCount);
  assert.deepEqual(D.topics(), full.topics);
  assert.equal(D.topicLabel(full.topics[0].id), full.topics[0].label);
  assert.equal(D.loaded(), false);
});

test("the dataset is required only when questions are actually needed", () => {
  assert.throws(() => D.pool(["2"]), /not loaded/);
  assert.throws(() => D.questions(), /not loaded/);
});

test("load() is a single promise and marks the dataset as loaded", async () => {
  const first = D.load();
  const second = D.load();
  assert.equal(first, second);
  await first;
  assert.equal(D.loaded(), true);
  assert.equal(D.pool(["2"]).length, full.questions.filter((q) => q.topic === "2").length);
});
