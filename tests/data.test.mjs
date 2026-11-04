import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../data/questions.js", import.meta.url), "utf8");
(0, eval)(src);
const data = globalThis.IHF_DATA;

test("dataset exposes meta, topics and questions", () => {
  assert.ok(data.meta.questionCount > 0);
  assert.equal(data.questions.length, data.meta.questionCount);
  assert.ok(data.topics.length >= 19);
});

test("question ids are unique and well formed", () => {
  const ids = data.questions.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^(\d{1,2}\.\d{1,2}|SAR\d{1,2})$/);
});

test("every question is complete and internally consistent", () => {
  const topicIds = new Set(data.topics.map((t) => t.id));
  for (const q of data.questions) {
    assert.ok(topicIds.has(q.topic), `${q.id}: unknown topic ${q.topic}`);
    assert.ok(q.text.trim().length >= 10, `${q.id}: empty text`);
    assert.ok(q.options.length >= 2, `${q.id}: too few options`);

    const letters = q.options.map((o) => o.letter);
    assert.deepEqual(
      letters,
      letters.map((_, i) => String.fromCharCode(97 + i)),
      `${q.id}: option letters must run a, b, c...`,
    );
    for (const o of q.options) assert.ok(o.text.trim().length > 0, `${q.id}.${o.letter}: empty`);

    assert.ok(q.answer.length >= 1, `${q.id}: no correct answer`);
    for (const a of q.answer) assert.ok(letters.includes(a), `${q.id}: answer ${a} not an option`);
    assert.equal(new Set(q.answer).size, q.answer.length, `${q.id}: duplicate answer`);

    assert.ok(q.rules.trim().length > 0, `${q.id}: no guidelines`);
    assert.ok(!/^[,;.]/.test(q.rules), `${q.id}: malformed guidelines ${q.rules}`);
  }
});

test("the dataset mixes single-answer and multi-answer questions", () => {
  const multi = data.questions.filter((q) => q.answer.length > 1);
  assert.ok(multi.length > 100, "expected a substantial multi-answer population");
  assert.ok(multi.length < data.questions.length, "expected single-answer questions too");
});
