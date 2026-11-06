/**
 * PDF report rules that must stay aligned with the on-screen results screen:
 * the four review states (accepted / partial / failed / unanswered) and a file
 * name whose numbers match the score shown in the summary.
 */
import test from "node:test";
import assert from "node:assert/strict";

import "../scripts/pdf.js";

const PDF = globalThis.IHFPdf;

function result(answer, selected, correct) {
  return { question: { answer: answer }, selected: selected, correct: correct };
}

test("a question only counts as accepted when every correct option was picked", () => {
  assert.equal(PDF.statusOf(result(["a", "b"], ["a", "b"], true)), "accepted");
});

test("an empty selection is unanswered, not failed", () => {
  assert.equal(PDF.statusOf(result(["a"], [], false)), "unanswered");
});

test("picking an option outside the key is a miss", () => {
  assert.equal(PDF.statusOf(result(["a", "b"], ["a", "c"], false)), "failed");
});

test("a correct but incomplete selection is partial, like the review screen", () => {
  assert.equal(PDF.statusOf(result(["a", "b"], ["a"], false)), "partial");
});

test("status labels reuse the on-screen wording", () => {
  assert.equal(PDF.STATUS_LABELS.accepted, "ACERTADA");
  assert.equal(PDF.STATUS_LABELS.partial, "PARCIAL");
  assert.equal(PDF.STATUS_LABELS.failed, "FALLADA");
  assert.equal(PDF.STATUS_LABELS.unanswered, "SIN RESPONDER");
});

test("file name repeats the answer score shown in the summary", () => {
  const report = { score: 9, totalAnswers: 12 };
  assert.equal(
    PDF.filenameFor(report, "2026-11-06"),
    "ihf-test-9-de-12-2026-11-06.pdf",
  );
});
