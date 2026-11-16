// The exam in progress, kept in localStorage so a reload or a closed tab does
// not throw away a timed attempt. Storage is injected in tests.

const KEY = 'ihf.exam.v1'
const VERSION = 1

const defaultStorage = () => {
  try {
    return window.localStorage
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

export const clear = (storage = defaultStorage()) => {
  if (!storage) return false
  try {
    storage.removeItem(KEY)
    return true
  } catch {
    return false
  }
}

export const save = (session, storage = defaultStorage()) => {
  if (!storage) return false
  try {
    storage.setItem(KEY, JSON.stringify({ v: VERSION, ...session }))
    return true
  } catch {
    return false
  }
}

// An expired session is still returned: the quiz mounts, the clock expires on
// its first tick and delivers the saved answers, which is what the timer would
// have done had the tab stayed open.
export const load = (storage = defaultStorage()) => {
  if (!storage) return null
  let raw
  try {
    raw = storage.getItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    clear(storage)
    return null
  }

  if (!isSession(parsed)) {
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
