import { test } from 'node:test'
import assert from 'node:assert/strict'
import { passes, percentage, questionPoints, questionStatus, requiredCorrect, STATUS } from '../scripts/scoring.js'

test('percentage is computed over the number of possible answers, two decimals', () => {
  assert.equal(percentage(5, 6), 83.33)
  assert.equal(percentage(4, 6), 66.67)
  assert.equal(percentage(7, 9), 77.78)
  assert.equal(percentage(6, 9), 66.67)
  assert.equal(percentage(15, 20), 75)
  assert.equal(percentage(0, 6), 0)
  assert.equal(percentage(3, 0), 0)
})

test('a negative score reports 0%, never a negative percentage', () => {
  assert.equal(percentage(-1, 6), 0)
  assert.equal(percentage(-12, 12), 0)
})

test('pass mark is 80% of the possible answers', () => {
  assert.equal(passes(5, 6), true)
  assert.equal(passes(4, 6), false)
  assert.equal(passes(8, 9), true)
  assert.equal(passes(7, 9), false)
  assert.equal(passes(4, 5), true)
  assert.equal(passes(3, 5), false)
  assert.equal(passes(16, 20), true)
  assert.equal(passes(15, 20), false)
  assert.equal(passes(24, 30), true)
  assert.equal(passes(23, 30), false)
  assert.equal(passes(0, 5), false)
})

test('requiredCorrect reports the minimum answers needed to pass', () => {
  assert.equal(requiredCorrect(6), 5)
  assert.equal(requiredCorrect(9), 8)
  assert.equal(requiredCorrect(5), 4)
  assert.equal(requiredCorrect(20), 16)
  assert.equal(requiredCorrect(30), 24)
})

test('the required points are exactly the first passing score', () => {
  for (const total of [5, 6, 7, 9, 10, 12, 20, 23, 30, 33]) {
    const required = requiredCorrect(total)
    assert.equal(passes(required, total), true, `${required}/${total} should pass`)
    assert.equal(passes(required - 1, total), false, `${required - 1}/${total} should fail`)
  }
})

test('questionPoints adds one point per correct pick and subtracts one per wrong pick', () => {
  assert.equal(questionPoints(['a', 'b'], ['a', 'b']), 2)
  assert.equal(questionPoints(['b', 'a'], ['a', 'b']), 2)
  assert.equal(questionPoints(['a'], ['a', 'b']), 1)
  assert.equal(questionPoints([], ['a', 'b']), 0)
  assert.equal(questionPoints(['a', 'c'], ['a', 'b']), 0)
  assert.equal(questionPoints(['b', 'c'], ['a', 'b']), 0)
  assert.equal(questionPoints(['a', 'b', 'c'], ['a', 'b']), 1)
  assert.equal(questionPoints(['c'], ['a', 'b']), -1)
  assert.equal(questionPoints(['a', 'c', 'd'], ['a', 'b']), -1)
  assert.equal(questionPoints(['c', 'd'], ['a', 'b']), -2)
})

test('questionStatus follows the net points of the question', () => {
  assert.equal(questionStatus([], ['a', 'b']), STATUS.unanswered)
  assert.equal(questionStatus(['a', 'b'], ['a', 'b']), STATUS.correct)
  assert.equal(questionStatus(['a'], ['a', 'b']), STATUS.partial)
  assert.equal(questionStatus(['a', 'b', 'c'], ['a', 'b']), STATUS.partial)
  assert.equal(questionStatus(['a', 'c'], ['a', 'b']), STATUS.wrong)
  assert.equal(questionStatus(['c'], ['a', 'b']), STATUS.wrong)
})
