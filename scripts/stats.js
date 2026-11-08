import { questionStatus } from './scoring.js'

export const KEY = 'ihf.stats.v1'
export const SCHEMA_VERSION = 1
export const MAX_ATTEMPTS = 200
export const MODES = { full: 'full', retry: 'retry' }
export const MIN_RULE_SEEN = 3

const STATUSES = ['correct', 'partial', 'wrong', 'unanswered']
const OTHER_RULE = 'otros'
// Below this delta a change is noise, not a trend.
const TREND_EPSILON = 0.5

const round2 = (value) => Math.round(value * 100) / 100

const average = (values) => {
  if (!values.length) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)

const defaultStorage = () => {
  try {
    return globalThis.localStorage || null
  } catch {
    return null
  }
}

export const empty = () => ({ v: SCHEMA_VERSION, attempts: [] })

const sanitizeItem = (item) => {
  if (!item || typeof item !== 'object') return null
  if (typeof item.q !== 'string' || !item.q) return null
  if (!STATUSES.includes(item.s)) return null
  return {
    q: item.q,
    s: item.s,
    p: isFiniteNumber(item.p) ? item.p : 0,
    a: isFiniteNumber(item.a) ? item.a : 0,
  }
}

const sanitizeAttempt = (attempt) => {
  if (!attempt || typeof attempt !== 'object') return null
  if (!isFiniteNumber(attempt.at) || !isFiniteNumber(attempt.pct)) return null
  if (!Array.isArray(attempt.items)) return null
  const items = attempt.items.map(sanitizeItem).filter(Boolean)
  return {
    at: attempt.at,
    mode: attempt.mode === MODES.retry ? MODES.retry : MODES.full,
    size: isFiniteNumber(attempt.size) ? attempt.size : items.length,
    elapsed: isFiniteNumber(attempt.elapsed) ? attempt.elapsed : 0,
    score: isFiniteNumber(attempt.score) ? attempt.score : 0,
    totalAnswers: isFiniteNumber(attempt.totalAnswers) ? attempt.totalAnswers : 0,
    pct: attempt.pct,
    passed: !!attempt.passed,
    items,
  }
}

// Corrupt, foreign-version or blocked storage always yields an empty history.
export const load = (storage = defaultStorage()) => {
  if (!storage) return empty()

  let raw
  try {
    raw = storage.getItem(KEY)
  } catch {
    return empty()
  }
  if (!raw) return empty()

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return empty()
  }
  if (!parsed || parsed.v !== SCHEMA_VERSION || !Array.isArray(parsed.attempts)) return empty()

  return {
    v: SCHEMA_VERSION,
    attempts: parsed.attempts.map(sanitizeAttempt).filter(Boolean),
  }
}

// Returns false when the browser refuses the write (quota, private mode).
export const save = (state, storage = defaultStorage()) => {
  if (!storage) return false
  try {
    storage.setItem(KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export const appendAttempt = (state, attempt) => {
  const base = state && Array.isArray(state.attempts) ? state : empty()
  const attempts = base.attempts.concat([attempt])
  const kept = attempts.length > MAX_ATTEMPTS ? attempts.slice(-MAX_ATTEMPTS) : attempts
  return { v: SCHEMA_VERSION, attempts: kept }
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

// Loads, appends and saves one attempt. `ok` reports the write only: the
// returned state is still useful to the caller when the write failed.
export const record = (attempt, storage = defaultStorage()) => {
  const state = appendAttempt(load(storage), attempt)
  return { ok: save(state, storage), state }
}

export const all = (storage = defaultStorage()) => load(storage).attempts

export const toAttempt = (report, mode, now) => {
  const items = (report.results || []).map((result) => {
    const status = result.status || questionStatus(result.selected, result.question.answer)
    return {
      q: result.question.id,
      s: status,
      p: result.points,
      a: result.question.answer.length,
    }
  })

  return {
    at: isFiniteNumber(now) ? now : Date.now(),
    mode: mode === MODES.retry ? MODES.retry : MODES.full,
    size: report.total,
    elapsed: report.elapsedTime || 0,
    score: report.score,
    totalAnswers: report.totalAnswers,
    pct: report.percentage,
    passed: !!report.passed,
    items,
  }
}

export const summary = (attempts) => {
  const counts = { correct: 0, partial: 0, wrong: 0, unanswered: 0 }
  const pcts = []
  let passed = 0
  let questions = 0
  let score = 0
  let totalAnswers = 0

  attempts.forEach((attempt) => {
    if (isFiniteNumber(attempt.pct)) pcts.push(attempt.pct)
    if (attempt.passed) passed += 1
    score += attempt.score || 0
    totalAnswers += attempt.totalAnswers || 0
    const items = attempt.items || []
    items.forEach((item) => {
      questions += 1
      if (counts[item.s] !== undefined) counts[item.s] += 1
    })
  })

  return {
    attempts: attempts.length,
    questions,
    counts,
    averagePct: round2(average(pcts)),
    bestPct: pcts.length ? Math.max(...pcts) : 0,
    lastPct: pcts.length ? pcts[pcts.length - 1] : 0,
    passed,
    failed: attempts.length - passed,
    score,
    totalAnswers,
  }
}

// Improved / worsened / stable by comparing the recent half against the
// previous half. Retry sessions are excluded: they re-run the questions that
// were already missed and would bias the trend.
export const trend = (attempts) => {
  const full = attempts.filter((attempt) => attempt.mode !== MODES.retry && isFiniteNumber(attempt.pct))

  if (full.length < 2) {
    return {
      direction: 'insufficient',
      delta: 0,
      previousPct: null,
      recentPct: null,
      previousCount: 0,
      recentCount: full.length,
    }
  }

  const recentCount = Math.ceil(full.length / 2)
  const previousCount = full.length - recentCount
  const previousPct = round2(average(full.slice(0, previousCount).map((attempt) => attempt.pct)))
  const recentPct = round2(average(full.slice(previousCount).map((attempt) => attempt.pct)))
  const delta = round2(recentPct - previousPct)
  const direction = Math.abs(delta) < TREND_EPSILON ? 'stable' : delta > 0 ? 'improved' : 'worsened'

  return { direction, delta, previousPct, recentPct, previousCount, recentCount }
}

export const primaryRule = (question) => {
  const raw = question && question.rules ? String(question.rules).split(',')[0].trim() : ''
  const match = raw.match(/^(\d{1,2})[:.]/)
  return match ? match[1] : OTHER_RULE
}

export const ruleLabel = (key) => (key === OTHER_RULE ? 'Otros' : `Regla ${key}`)

// Groups every answered question by its primary rule, with accuracy over
// possible answers (the same denominator the score uses).
export const byRule = (attempts, questionsById) => {
  const groups = {}
  const order = []

  attempts.forEach((attempt) => {
    const items = attempt.items || []
    items.forEach((item) => {
      const key = primaryRule(questionsById && questionsById[item.q])
      if (!groups[key]) {
        groups[key] = {
          rule: key,
          label: ruleLabel(key),
          seen: 0,
          correct: 0,
          partial: 0,
          wrong: 0,
          unanswered: 0,
          score: 0,
          totalAnswers: 0,
          accuracy: 0,
        }
        order.push(key)
      }
      const group = groups[key]
      group.seen += 1
      if (group[item.s] !== undefined) group[item.s] += 1
      group.score += item.p || 0
      group.totalAnswers += item.a || 0
    })
  })

  const rules = order.map((key) => {
    const group = groups[key]
    group.accuracy = group.totalAnswers ? round2((group.score / group.totalAnswers) * 100) : 0
    return group
  })

  rules.sort((a, b) => {
    if (b.seen !== a.seen) return b.seen - a.seen
    if (a.rule === OTHER_RULE) return 1
    if (b.rule === OTHER_RULE) return -1
    return Number(a.rule) - Number(b.rule)
  })

  let weakest = null
  rules.forEach((group) => {
    if (group.rule === OTHER_RULE || group.seen < MIN_RULE_SEEN) return
    if (!weakest || group.accuracy < weakest.accuracy) weakest = group
  })

  return {
    rules,
    mostPracticed: rules.length ? rules[0] : null,
    weakest,
  }
}

export const exportJson = (attempts, now) =>
  JSON.stringify(
    {
      v: SCHEMA_VERSION,
      exportedAt: new Date(isFiniteNumber(now) ? now : Date.now()).toISOString(),
      attempts,
    },
    null,
    2,
  )
