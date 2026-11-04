import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const rulesUrl = new URL("../data/rules.js", import.meta.url);

(0, eval)(readFileSync(new URL("../data/questions.js", import.meta.url), "utf8"));
let rules = null;
if (existsSync(rulesUrl)) {
  (0, eval)(readFileSync(rulesUrl, "utf8"));
  rules = globalThis.IHF_RULES;
}
(0, eval)(readFileSync(new URL("../scripts/data.js", import.meta.url), "utf8"));
const D = globalThis.IHFData;
const questions = globalThis.IHF_DATA.questions;

function allChips() {
  return questions.flatMap((q) =>
    D.chips(q).map((c) => ({ qid: q.id, topic: q.topic, ...c })),
  );
}

function requireRules() {
  assert.ok(rules, "data/rules.js is missing — run `python3 tools/extract_rules.py`");
}

test("rules dataset is generated and complete", () => {
  requireRules();
  assert.ok(rules.meta.generated, "meta.generated must be set");
  assert.ok(Object.keys(rules.paragraphs).length > 100, "too few rule paragraphs");
  assert.ok(Object.keys(rules.aclaraciones).length >= 8, "too few aclaraciones");
  assert.ok(Object.keys(rules.directrices).length > 15, "too few directrices");
});

test("every extracted block has a real page and usable text", () => {
  requireRules();
  const blocks = [
    ...Object.values(rules.paragraphs),
    ...Object.values(rules.aclaraciones),
    ...Object.values(rules.directrices).flat(),
  ];
  assert.ok(blocks.length > 100);
  for (const b of blocks) {
    assert.ok(Number.isInteger(b.page) && b.page >= 1 && b.page <= 113, `bad page ${b.page}`);
    assert.ok(b.text.trim().length >= 60, `text too short: ${b.text.slice(0, 40)}`);
    assert.ok(b.text.length <= 4000, `text too long: ${b.text.length}`);
    assert.ok(!b.text.includes("Reglas de Juego de Balonmano Pista"), "running footer leaked");
    assert.ok(!/^REGLA \d{1,2}:/.test(b.text), "running header leaked");
  }
});

test("chips quoting a rule paragraph resolve to supporting text", () => {
  requireRules();
  const chips = allChips().filter((c) => /^\d{1,2}[:.]\d/.test(c.raw));
  assert.ok(chips.length > 500, `expected many rule references, got ${chips.length}`);
  const missing = chips.filter((c) => !c.quote);
  const rate = (chips.length - missing.length) / chips.length;
  assert.ok(rate >= 0.9, `only ${ (rate * 100).toFixed(1) }% resolved; e.g. ${missing.slice(0, 8).map((m) => `${m.qid}:${m.raw}`)}`);
  for (const c of chips.filter((x) => x.quote)) {
    assert.ok(c.quote.text.length >= 60, `${c.raw}: quote too short`);
    assert.ok(c.quote.page >= 1 && c.quote.page <= 113, `${c.raw}: bad page`);
  }
});

test("chips citing a clarification resolve to that clarification", () => {
  requireRules();
  const chips = allChips().filter((c) => /^(clarification|aclaraci)/i.test(c.raw));
  assert.ok(chips.length >= 50, `expected clarification references, got ${chips.length}`);
  const missing = chips.filter((c) => !c.quote);
  assert.equal(missing.length, 0, `unresolved: ${missing.map((m) => `${m.qid}:${m.raw}`).slice(0, 8)}`);
  const sevenB = chips.find((c) => /^Clarification 7B$/i.test(c.raw));
  assert.ok(sevenB && sevenB.quote.text.includes("INTERRUPCIÓN"), "7B must quote its sub-block");
});

test("chips citing a guideline fall back to the guideline or the rule text", () => {
  requireRules();
  const chips = allChips().filter((c) => /^guideline/i.test(c.raw));
  assert.ok(chips.length >= 15, `expected guideline references, got ${chips.length}`);
  const missing = chips.filter((c) => !c.quote);
  assert.equal(missing.length, 0, `unresolved: ${missing.map((m) => `${m.qid}:${m.raw}`)}`);
});

test("regulations outside the rules PDF keep a chip without a quote", () => {
  requireRules();
  const chips = allChips().filter((c) => /regulations/i.test(c.raw) && !/substitution area/i.test(c.raw));
  assert.ok(chips.length >= 5, `expected standalone regulations, got ${chips.length}`);
  for (const c of chips) {
    assert.equal(c.quote, null, `${c.raw} should not quote the rules PDF`);
    assert.ok(c.label, "chip label must survive");
  }
});
