import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { chips } from '../scripts/data.js'

const rulesUrl = new URL('../data/rules.js', import.meta.url)
const evaluate = (source) => (0, eval)(source)

evaluate(readFileSync(new URL('../data/questions.js', import.meta.url), 'utf8'))
let rules = null
if (existsSync(rulesUrl)) {
  evaluate(readFileSync(rulesUrl, 'utf8'))
  rules = globalThis.IHF_RULES
}

const questions = globalThis.IHF_DATA.questions

const allChips = () =>
  questions.flatMap((question) =>
    chips(question).map((chip) => ({ qid: question.id, topic: question.topic, ...chip })),
  )

const requireRules = () => {
  assert.ok(rules, 'data/rules.js is missing — run `python3 tools/extract_rules.py`')
}

test('rules dataset is generated and complete', () => {
  requireRules()
  assert.ok(rules.meta.generated, 'meta.generated must be set')
  assert.ok(Object.keys(rules.paragraphs).length > 100, 'too few rule paragraphs')
  assert.ok(Object.keys(rules.aclaraciones).length >= 8, 'too few aclaraciones')
  assert.ok(Object.keys(rules.directrices).length > 15, 'too few directrices')
})

test('every extracted block has a real page and usable text', () => {
  requireRules()
  const blocks = [
    ...Object.values(rules.paragraphs),
    ...Object.values(rules.aclaraciones),
    ...Object.values(rules.directrices).flat(),
  ]
  assert.ok(blocks.length > 100)
  for (const block of blocks) {
    assert.ok(Number.isInteger(block.page) && block.page >= 1 && block.page <= 113, `bad page ${block.page}`)
    assert.ok(block.text.trim().length >= 60, `text too short: ${block.text.slice(0, 40)}`)
    assert.ok(block.text.length <= 4000, `text too long: ${block.text.length}`)
    assert.ok(!block.text.includes('Reglas de Juego de Balonmano Pista'), 'running footer leaked')
    assert.ok(!/^REGLA \d{1,2}:/.test(block.text), 'running header leaked')
  }
})

test('chips quoting a rule paragraph resolve to supporting text', () => {
  requireRules()
  const ruleChips = allChips().filter((chip) => /^\d{1,2}[:.]\d/.test(chip.raw))
  assert.ok(ruleChips.length > 500, `expected many rule references, got ${ruleChips.length}`)

  const missing = ruleChips.filter((chip) => !chip.quote)
  const rate = (ruleChips.length - missing.length) / ruleChips.length
  const examples = missing.slice(0, 8).map((chip) => `${chip.qid}:${chip.raw}`)
  assert.ok(rate >= 0.9, `only ${(rate * 100).toFixed(1)}% resolved; e.g. ${examples}`)

  for (const chip of ruleChips.filter((entry) => entry.quote)) {
    assert.ok(chip.quote.text.length >= 60, `${chip.raw}: quote too short`)
    assert.ok(chip.quote.page >= 1 && chip.quote.page <= 113, `${chip.raw}: bad page`)
  }
})

test('chips citing a clarification resolve to that clarification', () => {
  requireRules()
  const clarifications = allChips().filter((chip) => /^(clarification|aclaraci)/i.test(chip.raw))
  assert.ok(clarifications.length >= 50, `expected clarification references, got ${clarifications.length}`)

  // A citation that names no number cannot resolve: it keeps the chip and the
  // page link, like the regulations outside the rules PDF.
  const numbered = clarifications.filter((chip) => /\d/.test(chip.raw))
  const missing = numbered.filter((chip) => !chip.quote)
  assert.equal(missing.length, 0, `unresolved: ${missing.map((chip) => `${chip.qid}:${chip.raw}`).slice(0, 8)}`)

  const unnumbered = clarifications.filter((chip) => !/\d/.test(chip.raw))
  for (const chip of unnumbered) {
    assert.equal(chip.quote, null, `${chip.raw} cites no number, so it cannot quote`)
  }

  const sevenB = clarifications.find((chip) => /^Clarification 7B$/i.test(chip.raw))
  assert.ok(sevenB && sevenB.quote.text.includes('INTERRUPCIÓN'), '7B must quote its sub-block')
})

test('chips citing a guideline fall back to the guideline or the rule text', () => {
  requireRules()
  // The July 2025 Spanish catalogue cites 10 guidelines.
  const guidelines = allChips().filter((chip) => /^guideline/i.test(chip.raw))
  assert.ok(guidelines.length >= 10, `expected guideline references, got ${guidelines.length}`)

  const numbered = guidelines.filter((chip) => /\d/.test(chip.raw))
  const missing = numbered.filter((chip) => !chip.quote)
  assert.equal(missing.length, 0, `unresolved: ${missing.map((chip) => `${chip.qid}:${chip.raw}`)}`)

  const unnumbered = guidelines.filter((chip) => !/\d/.test(chip.raw))
  for (const chip of unnumbered) {
    assert.equal(chip.quote, null, `${chip.raw} cites no rule, so it cannot quote`)
  }
})

test('regulations outside the rules PDF keep a chip without a quote', () => {
  requireRules()
  const regulations = allChips().filter((chip) => /regulations/i.test(chip.raw) && !/substitution area/i.test(chip.raw))
  assert.ok(regulations.length >= 5, `expected standalone regulations, got ${regulations.length}`)

  for (const chip of regulations) {
    assert.equal(chip.quote, null, `${chip.raw} should not quote the rules PDF`)
    assert.ok(chip.label, 'chip label must survive')
  }
})
