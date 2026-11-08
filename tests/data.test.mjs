import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../data/questions.js', import.meta.url), 'utf8')
const data = (0, eval)(source) || globalThis.IHF_DATA

test('dataset exposes meta, topics and questions', () => {
  assert.ok(data.meta.questionCount > 0)
  assert.equal(data.questions.length, data.meta.questionCount)
  assert.ok(data.topics.length >= 19)
})

test('question ids are unique and well formed', () => {
  const ids = data.questions.map((question) => question.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^(\d{1,2}\.\d{1,2}|SAR\d{1,2})$/)
})

test('every question is complete and internally consistent', () => {
  const topicIds = new Set(data.topics.map((topic) => topic.id))

  for (const question of data.questions) {
    assert.ok(topicIds.has(question.topic), `${question.id}: unknown topic ${question.topic}`)
    assert.ok(question.text.trim().length >= 10, `${question.id}: empty text`)
    assert.ok(question.options.length >= 2, `${question.id}: too few options`)

    const letters = question.options.map((option) => option.letter)
    assert.deepEqual(
      letters,
      letters.map((_, index) => String.fromCharCode(97 + index)),
      `${question.id}: option letters must run a, b, c...`,
    )
    for (const option of question.options) {
      assert.ok(option.text.trim().length > 0, `${question.id}.${option.letter}: empty`)
    }

    assert.ok(question.answer.length >= 1, `${question.id}: no correct answer`)
    for (const letter of question.answer) {
      assert.ok(letters.includes(letter), `${question.id}: answer ${letter} not an option`)
    }
    assert.equal(new Set(question.answer).size, question.answer.length, `${question.id}: duplicate answer`)

    assert.ok(question.rules.trim().length > 0, `${question.id}: no guidelines`)
    assert.ok(!/^[,;.]/.test(question.rules), `${question.id}: malformed guidelines ${question.rules}`)
  }
})

test('the dataset mixes single-answer and multi-answer questions', () => {
  const multi = data.questions.filter((question) => question.answer.length > 1)
  assert.ok(multi.length > 100, 'expected a substantial multi-answer population')
  assert.ok(multi.length < data.questions.length, 'expected single-answer questions too')
})
