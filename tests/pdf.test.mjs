/**
 * PDF report rules that must stay aligned with the on-screen results screen:
 * the four review states and a file name whose numbers match the score.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { STATUS_LABELS, filenameFor, statusOf } from '../scripts/pdf.js'

const result = (answer, selected, correct) => ({ question: { answer }, selected, correct })

test('a question only counts as accepted when every correct option was picked', () => {
  assert.equal(statusOf(result(['a', 'b'], ['a', 'b'], true)), 'accepted')
})

test('an empty selection is unanswered, not failed', () => {
  assert.equal(statusOf(result(['a'], [], false)), 'unanswered')
})

test('picking an option outside the key is a miss', () => {
  assert.equal(statusOf(result(['a', 'b'], ['a', 'c'], false)), 'failed')
})

test('a correct but incomplete selection is partial, like the review screen', () => {
  assert.equal(statusOf(result(['a', 'b'], ['a'], false)), 'partial')
})

test('status labels reuse the on-screen wording', () => {
  assert.equal(STATUS_LABELS.accepted, 'ACERTADA')
  assert.equal(STATUS_LABELS.partial, 'PARCIAL')
  assert.equal(STATUS_LABELS.failed, 'FALLADA')
  assert.equal(STATUS_LABELS.unanswered, 'SIN RESPONDER')
})

test('file name repeats the answer score shown in the summary', () => {
  const report = { score: 9, totalAnswers: 12 }
  assert.equal(filenameFor(report, '2026-11-06'), 'ihf-test-9-de-12-2026-11-06.pdf')
})
