// The exam in progress, kept in localStorage so a reload does not throw away a
// timed attempt. Storage is injected in tests.
//
// An exam cannot be paused: the clock runs on the deadline, so closing the tab
// and coming back only works while time is left. Two rules keep stale or
// foreign exams out of the way:
// - a session whose deadline already passed is dropped, never resumed;
// - a session owned by another tab that is still running is never overwritten,
//   so two tabs cannot silently clobber each other.

const KEY = 'ihf.exam.v1'
const TAB_KEY = 'ihf.exam.tab'
const VERSION = 1

const defaultStorage = () => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

// Per-tab identity: sessionStorage survives a reload but not a new tab, so a
// second tab never claims to be the one that started an exam.
const currentTab = () => {
  try {
    const existing = window.sessionStorage.getItem(TAB_KEY)
    if (existing) return existing
    const id = randomId()
    window.sessionStorage.setItem(TAB_KEY, id)
    return id
  } catch {
    return null
  }
}

const isSession = (value) =>
  !!value &&
  value.v === VERSION &&
  Number.isFinite(value.deadline) &&
  !!value.config &&
  Array.isArray(value.config.topics) &&
  Array.isArray(value.questionIds) &&
  value.questionIds.length > 0 &&
  Array.isArray(value.selected) &&
  value.selected.length === value.questionIds.length

const read = (storage) => {
  if (!storage) return null
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && parsed.v === VERSION ? parsed : null
  } catch {
    return null
  }
}

export const clear = (storage = defaultStorage()) => {
  if (!storage) return false
  try {
    storage.removeItem(KEY)
    return true
  } catch {
    return false
  }
}

export const save = (session, storage = defaultStorage(), context = {}) => {
  if (!storage) return false
  const tab = context.tab === undefined ? currentTab() : context.tab
  const now = context.now === undefined ? Date.now() : context.now

  // A live exam from another tab keeps the slot; this attempt still runs, it
  // just is not the one that would be resumed.
  const stored = read(storage)
  if (stored && stored.tab && tab && stored.tab !== tab && stored.deadline > now) return false

  try {
    storage.setItem(KEY, JSON.stringify({ v: VERSION, tab, ...session }))
    return true
  } catch {
    return false
  }
}

// Only a live session loads. Once the deadline passed the attempt is gone: it
// cannot be paused, so there is nothing to come back to.
export const load = (storage = defaultStorage(), now = Date.now()) => {
  if (!storage) return null

  let parsed
  try {
    parsed = JSON.parse(storage.getItem(KEY) || 'null')
  } catch {
    clear(storage)
    return null
  }

  if (!parsed) return null

  if (!isSession(parsed) || parsed.deadline <= now) {
    clear(storage)
    return null
  }

  return {
    config: parsed.config,
    deadline: parsed.deadline,
    questionIds: parsed.questionIds,
    selected: parsed.selected.map((letters) => (Array.isArray(letters) ? letters.filter((letter) => typeof letter === 'string') : [])),
  }
}
