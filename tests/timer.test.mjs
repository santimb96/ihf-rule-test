import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXAM, WARNING_THRESHOLDS, formatClock, remainingSeconds, warningDue, warningText } from '../scripts/timer.js'

test('the exam is 30 questions in 35 minutes', () => {
  assert.equal(EXAM.size, 30)
  assert.equal(EXAM.seconds, 35 * 60)
})

test('remaining seconds round up and never go below zero', () => {
  const deadline = 1_000_000
  assert.equal(remainingSeconds(deadline, 0), 1000)
  assert.equal(remainingSeconds(deadline, deadline), 0)
  assert.equal(remainingSeconds(deadline, deadline - 1500), 2)
  assert.equal(remainingSeconds(deadline, deadline + 5000), 0)
})

test('the clock shows minutes and seconds with two digits', () => {
  assert.equal(formatClock(2099), '34:59')
  assert.equal(formatClock(2100), '35:00')
  assert.equal(formatClock(60), '01:00')
  assert.equal(formatClock(9), '00:09')
  assert.equal(formatClock(0), '00:00')
  assert.equal(formatClock(-5), '00:00')
})

test('each warning fires once, at five minutes and at one minute', () => {
  assert.equal(WARNING_THRESHOLDS.length, 2)
  assert.equal(warningDue(301, []), null)
  assert.equal(warningDue(300, []), 300)
  assert.equal(warningDue(300, [300]), null)
  assert.equal(warningDue(120, [300]), null)
  assert.equal(warningDue(60, [300]), 60)
  assert.equal(warningDue(60, [300, 60]), null)
})

test('a late tick only announces the tightest warning', () => {
  assert.equal(warningDue(20, []), 60)
  assert.equal(warningDue(0, []), 60)
})

test('the warning copy names the time left', () => {
  assert.equal(warningText(300), 'Quedan 5 minutos de examen.')
  assert.equal(warningText(60), 'Queda 1 minuto de examen.')
})
