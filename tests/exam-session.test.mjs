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
  deadline: 1_800_000,
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

test('an expired session still loads: the clock delivers it on resume', () => {
  const storage = fakeStorage()
  ExamSession.save({ ...session, deadline: Date.now() - 60_000 }, storage)

  const loaded = ExamSession.load(storage)
  assert.ok(loaded)
  assert.ok(loaded.deadline < Date.now())
})

test('clear removes the stored exam', () => {
  const storage = fakeStorage()
  ExamSession.save(session, storage)
  assert.equal(ExamSession.clear(storage), true)
  assert.equal(ExamSession.load(storage), null)
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
