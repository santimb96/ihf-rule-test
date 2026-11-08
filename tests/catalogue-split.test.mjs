import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  configureCatalogue,
  getMeta,
  load,
  loaded,
  pool,
  poolSize,
  questions,
  topicLabel,
  topics,
} from '../scripts/data.js'

const questionsUrl = new URL('../data/questions.js', import.meta.url)
const evaluate = (source) => (0, eval)(source)

evaluate(readFileSync(questionsUrl, 'utf8'))
const full = globalThis.IHF_DATA

const counts = {}
full.questions.forEach((question) => {
  counts[question.topic] = (counts[question.topic] || 0) + 1
})

// Reproduce the production entry: the metadata ships with the first paint and
// the dataset arrives later, only when a test starts.
delete globalThis.IHF_DATA
configureCatalogue({ meta: full.meta, topics: full.topics, counts })

test('the setup screen can size the pool from the metadata alone', () => {
  const allTopics = full.topics.map((topic) => topic.id)
  assert.equal(poolSize(allTopics), full.questions.length)
  assert.equal(poolSize(['2']), full.questions.filter((question) => question.topic === '2').length)
  assert.equal(poolSize([]), 0)
})

test('labels and counts come from the metadata, not the dataset', () => {
  assert.equal(getMeta().questionCount, full.meta.questionCount)
  assert.deepEqual(topics(), full.topics)
  assert.equal(topicLabel(full.topics[0].id), full.topics[0].label)
  assert.equal(loaded(), false)
})

test('the dataset is required only when questions are actually needed', () => {
  assert.throws(() => pool(['2']), /not loaded/)
  assert.throws(() => questions(), /not loaded/)
})

test('load() is a single promise and marks the dataset as loaded', async () => {
  const first = load()
  const second = load()
  assert.equal(first, second)
  await first
  assert.equal(loaded(), true)
  assert.equal(pool(['2']).length, full.questions.filter((question) => question.topic === '2').length)
})
