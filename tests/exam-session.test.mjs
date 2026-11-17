import test from 'node:test'
import assert from 'node:assert/strict'
import * as ExamSession from '../scripts/exam-session.js'

const fakeStorage = () => {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    dump: () => Object.fromEntries(map),
  }
}

const session = {
  config: { topics: ['1', '2'], size: 30, mode: 'exam' },
  deadline: Date.now() + 30 * 60 * 1000,
  questionIds: ['1.1', '1.2'],
  selected: [['a'], []],
}

test('a saved exam can be loaded back untouched', () => {
  const storage = fakeStorage()
  assert.equal(ExamSession.save(session, storage), true)

  const loaded = ExamSession.load(storage)
  assert.deepEqual(loaded, session)
})

test('loading without a session is null, not a crash', () => {
  assert.equal(ExamSession.load(fakeStorage()), null)
  assert.equal(ExamSession.load(null), null)
})

test('corrupt or foreign data is dropped instead of half-loaded', () => {
  const storage = fakeStorage()
  storage.setItem('ihf.exam.v1', '{not json')
  assert.equal(ExamSession.load(storage), null)
  assert.deepEqual(storage.dump(), {})

  storage.setItem('ihf.exam.v1', JSON.stringify({ v: 99, deadline: 1, config: {}, questionIds: ['a'], selected: [[]] }))
  assert.equal(ExamSession.load(storage), null)
})

test('a session whose answers do not match its questions is rejected', () => {
  const storage = fakeStorage()
  storage.setItem(
    'ihf.exam.v1',
    JSON.stringify({ v: 1, ...session, selected: [['a']] }),
  )
  assert.equal(ExamSession.load(storage), null)
})

test('an exam whose time ran out is gone, never resumed', () => {
  const storage = fakeStorage()
  const now = Date.now()
  ExamSession.save({ ...session, deadline: now - 1000 }, storage, { tab: 'a', now })

  assert.equal(ExamSession.load(storage, now), null)
  assert.deepEqual(storage.dump(), {})
})

test('clear removes the stored exam', () => {
  const storage = fakeStorage()
  ExamSession.save(session, storage)
  assert.equal(ExamSession.clear(storage), true)
  assert.equal(ExamSession.load(storage), null)
})

test('an abandoned exam past its deadline from days ago is also gone', () => {
  const storage = fakeStorage()
  const now = Date.now()
  ExamSession.save({ ...session, deadline: now - 3 * 24 * 60 * 60 * 1000 }, storage, { tab: 'a', now })

  assert.equal(ExamSession.load(storage, now), null)
})

test('a live exam from another tab is never overwritten', () => {
  const storage = fakeStorage()
  const now = Date.now()
  ExamSession.save({ ...session, deadline: now + 600_000 }, storage, { tab: 'other', now })

  assert.equal(ExamSession.save({ ...session, deadline: now + 600_000 }, storage, { tab: 'mine', now }), false)
  assert.deepEqual(ExamSession.load(storage, now).questionIds, session.questionIds)
})

test('the same tab, or an expired foreign session, can be overwritten', () => {
  const storage = fakeStorage()
  const now = Date.now()
  ExamSession.save({ ...session, deadline: now + 600_000 }, storage, { tab: 'mine', now })
  assert.equal(ExamSession.save({ ...session, deadline: now + 600_000 }, storage, { tab: 'mine', now }), true)

  ExamSession.save({ ...session, deadline: now - 1000 }, storage, { tab: 'other', now })
  assert.equal(ExamSession.save({ ...session, deadline: now + 600_000 }, storage, { tab: 'mine', now }), true)
})

test('a storage that refuses writes degrades to false', () => {
  const blocked = {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota')
    },
    removeItem: () => {}
  }
  assert.equal(ExamSession.save(session, blocked), false)
  assert.equal(ExamSession.save(session, null), false)
})
