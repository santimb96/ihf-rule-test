import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createQuiz } from '../scripts/quiz.js'

const pool = Array.from({ length: 40 }, (_, index) => ({
  id: `1.${index + 1}`,
  topic: '1',
  text: `Question ${index + 1}`,
  options: [
    { letter: 'a', text: 'Option A' },
    { letter: 'b', text: 'Option B' },
  ],
  answer: [index % 3 === 0 ? 'a' : 'b'],
  rules: '1:1',
}))

test('createQuiz picks the requested number of distinct questions', () => {
  const quiz = createQuiz({ pool, size: 10, rng: () => 0.5 })
  assert.equal(quiz.items.length, 10)
  assert.equal(new Set(quiz.items.map((question) => question.id)).size, 10)
  for (const item of quiz.items) assert.ok(pool.includes(item))
})

test('createQuiz adapts size when pool is smaller', () => {
  const quiz = createQuiz({ pool: pool.slice(0, 4), size: 5 })
  assert.equal(quiz.items.length, 4)
  for (const item of quiz.items) assert.ok(pool.includes(item))
})

test('answers are stored per question and grading produces a report', () => {
  const quiz = createQuiz({ pool, size: 5, rng: () => 0 })
  const [first, second] = quiz.items
  quiz.select(0, first.answer)
  quiz.select(1, second.answer.concat('a').slice(0, 2))
  quiz.select(2, [])
  assert.deepEqual(quiz.selected(0), first.answer)
  assert.equal(quiz.answeredCount(), 2)

  const report = quiz.report()
  assert.equal(report.total, 5)
  assert.equal(report.results.length, 5)
  assert.equal(typeof report.correct, 'number')
  assert.equal(report.results[0].correct, true)
  assert.equal(report.results[1].correct, false)
  assert.equal(report.results[2].correct, false)
  assert.equal(report.results[0].points, 1)
  assert.equal(report.results[1].points, 0)
})

test('report exposes pass state using the 75% rule', () => {
  const quiz = createQuiz({ pool: pool.slice(0, 5), size: 5, rng: () => 0 })
  quiz.items.forEach((question, index) => {
    if (index < 4) quiz.select(index, question.answer)
  })

  const report = quiz.report()
  assert.equal(report.correct, 4)
  assert.equal(report.score, 4)
  assert.equal(report.totalAnswers, 5)
  assert.equal(report.passed, true)
  assert.equal(report.percentage, 80)
  assert.equal(report.required, 4)
})

test('the score counts answers, not questions', () => {
  const multi = [
    {
      id: '1.1',
      topic: '1',
      text: 'Multi answer',
      options: [
        { letter: 'a', text: 'Option A' },
        { letter: 'b', text: 'Option B' },
        { letter: 'c', text: 'Option C' },
      ],
      answer: ['a', 'b'],
      rules: '1:1',
    },
    {
      id: '1.2',
      topic: '1',
      text: 'Single answer',
      options: [
        { letter: 'a', text: 'Option A' },
        { letter: 'b', text: 'Option B' },
      ],
      answer: ['a'],
      rules: '1:2',
    },
  ]

  const quiz = createQuiz({ pool: multi, size: 2, rng: () => 0.5 })
  const multiIndex = quiz.items.findIndex((question) => question.answer.length === 2)
  const singleIndex = quiz.items.findIndex((question) => question.answer.length === 1)
  quiz.select(multiIndex, [quiz.items[multiIndex].answer[0]])
  quiz.select(singleIndex, quiz.items[singleIndex].answer)

  const report = quiz.report()
  assert.equal(report.total, 2)
  assert.equal(report.totalAnswers, 3)
  assert.equal(report.score, 2)
  assert.equal(report.percentage, 66.67)
  assert.equal(report.passed, false)
  assert.equal(report.required, 3)
})

test('report exposes one shared classification per question', () => {
  const questions = [
    {
      id: '9.1',
      topic: '9',
      text: 'Multi answer',
      options: [
        { letter: 'a', text: 'Option A' },
        { letter: 'b', text: 'Option B' },
      ],
      answer: ['a', 'b'],
      rules: '9:1',
    },
    {
      id: '9.2',
      topic: '9',
      text: 'Single answer',
      options: [
        { letter: 'a', text: 'Option A' },
        { letter: 'c', text: 'Option C' },
      ],
      answer: ['a'],
      rules: '9:2',
    },
    {
      id: '9.3',
      topic: '9',
      text: 'Unanswered',
      options: [{ letter: 'a', text: 'Option A' }],
      answer: ['a'],
      rules: '9:3',
    },
  ]

  const quiz = createQuiz({ pool: questions, size: 3, rng: () => 0.5 })
  const indexOf = (id) => quiz.items.findIndex((question) => question.id === id)

  quiz.select(indexOf('9.1'), ['a'])
  quiz.select(indexOf('9.2'), ['c'])

  const report = quiz.report()
  const statusById = Object.fromEntries(report.results.map((result) => [result.question.id, result.status]))

  assert.deepEqual(statusById, { '9.1': 'partial', '9.2': 'wrong', '9.3': 'unanswered' })
  assert.equal(report.results.find((result) => result.question.id === '9.1').correct, false)
})
