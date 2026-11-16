import test from 'node:test'
import assert from 'node:assert/strict'
import { installFakeDom, seedToast } from './helpers/fake-dom.mjs'

const { document } = installFakeDom()
const toast = seedToast(document)

const { load, topics, pool } = await import('../scripts/data.js')
await load()
const { mount: mountSetup } = await import('../scripts/screens/setup.js')
const { mount: mountQuiz } = await import('../scripts/screens/quiz.js')
const { mount: mountResults } = await import('../scripts/screens/results.js')
const { open: openStats } = await import('../scripts/screens/stats.js')
const { createQuiz } = await import('../scripts/quiz.js')
const { EXAM } = await import('../scripts/timer.js')
const Stats = await import('../scripts/stats.js')

const ALL_TOPICS = topics().map((topic) => topic.id)
const FULL_POOL = pool(ALL_TOPICS)

let now = 1_000_000
Date.now = () => now
let interval = null
globalThis.setInterval = (fn) => {
  interval = fn
  return 1
}
globalThis.clearInterval = () => {
  interval = null
}
const tick = () => interval?.()

const byText = (root, text) => root.querySelectorAll('button').find((button) => button.textContent.trim() === text)

// --- setup -----------------------------------------------------------------
test('the mode selector is a radio group that responds to arrows', () => {
  const screen = document.createElement('div')
  mountSetup(screen, { onStart: () => {} })

  const [practice, exam] = screen.querySelectorAll('[data-mode]')
  assert.equal(screen.querySelector('[role="radiogroup"]').getAttribute('aria-labelledby'), 'mode-title')
  assert.equal(practice.getAttribute('role'), 'radio')
  assert.equal(practice.getAttribute('aria-checked'), 'true')
  assert.equal(exam.getAttribute('aria-checked'), 'false')
  assert.equal(practice.tabIndex, 0)
  assert.equal(exam.tabIndex, -1)

  practice.dispatch('keydown', { key: 'ArrowRight' })
  assert.equal(exam.getAttribute('aria-checked'), 'true')
  assert.equal(exam.tabIndex, 0)
})

test('an exam draws from the whole catalogue even with no practice topics', () => {
  const screen = document.createElement('div')
  const starts = []
  mountSetup(screen, { onStart: (config) => starts.push(config) })

  byText(screen, 'Quitar todos').click()
  screen.querySelector('[data-mode="exam"]').click()
  screen.querySelector('[data-action="start"]').click()

  assert.equal(starts.length, 1)
  assert.deepEqual(starts[0], { topics: ALL_TOPICS, size: EXAM.size, mode: 'exam' })
})

test('a saved exam shows a resume banner with its remaining time', () => {
  const screen = document.createElement('div')
  const calls = []
  mountSetup(screen, {
    onStart: () => {},
    resume: { config: { topics: ALL_TOPICS, size: EXAM.size, mode: 'exam' }, deadline: now + 90_000, questionIds: ['1.1'], selected: [[]] },
    onResume: () => calls.push('resume'),
    onDiscardResume: () => calls.push('discard'),
  })

  assert.match(screen.textContent, /Tienes un examen a medias/)
  assert.match(screen.textContent, /Quedan 01:30/)
  screen.querySelector('[data-action="resume-exam"]').click()
  screen.querySelector('[data-action="discard-exam"]').click()
  assert.deepEqual(calls, ['resume', 'discard'])
})

test('an exam without a saved attempt shows no banner', () => {
  const screen = document.createElement('div')
  mountSetup(screen, { onStart: () => {} })
  assert.doesNotMatch(screen.textContent, /Tienes un examen a medias/)
})

// --- briefing ---------------------------------------------------------------
test('the briefing lists the scoring rules and starts on confirm', async () => {
  const { openBriefing } = await import('../scripts/exam-briefing.js')
  let started = 0
  openBriefing(() => {
    started += 1
  })

  const dialog = document.getElementById('exam-briefing')
  assert.ok(dialog)
  for (const needle of ['varias respuestas', 'suma un punto', 'resta un punto', 'no suman ni restan (0)', '35 minutos']) {
    assert.ok(dialog.textContent.includes(needle), `briefing mentions ${needle}`)
  }
  assert.doesNotMatch(dialog.textContent, /cuenta como fallo/)

  dialog.querySelector('[data-action="confirm-exam"]').click()
  assert.equal(started, 1)
  assert.equal(document.getElementById('exam-briefing'), null)
})

// --- quiz ------------------------------------------------------------------
const examQuiz = () => createQuiz({ pool: FULL_POOL, size: EXAM.size })

const mountExam = (options = {}) => {
  const node = document.createElement('div')
  const state = { finishes: 0, exits: 0, progress: 0, report: null }
  const quiz = options.quiz || examQuiz()
  now = options.now || 2_000_000
  const deadline = options.deadline ?? now + EXAM.seconds * 1000
  mountQuiz(node, {
    quiz,
    mode: options.mode || 'exam',
    deadline: options.mode === 'practice' ? null : deadline,
    onProgress: () => {
      state.progress += 1
    },
    onFinish: (report) => {
      state.finishes += 1
      state.report = report
    },
    onExit: () => {
      state.exits += 1
    },
  })
  return { node, state, quiz, deadline }
}

const goToLast = (node, total) => {
  for (let i = 0; i < total - 1; i++) node.querySelector('[data-action="next"]').click()
}

test('the exam clock starts at 35:00 with the hints removed', () => {
  const { node, quiz } = mountExam()
  assert.match(node.textContent, /35:00/)
  assert.ok(!node.textContent.includes('Ver pista'))

  goToLast(node, quiz.items.length)
  assert.ok(node.textContent.includes('Finalizar examen'))
})

test('the last five minutes and the last minute are announced once each', () => {
  const { node, deadline } = mountExam()
  toast.textContent = ''

  now = deadline - 301_000
  tick()
  assert.equal(toast.textContent, '')
  assert.match(node.textContent, /05:01/)

  now = deadline - 300_000
  tick()
  assert.equal(toast.textContent, 'Quedan 5 minutos de examen.')
  assert.match(node.querySelector('[aria-label="Tiempo restante de examen"]').className, /amber/)

  tick()
  assert.match(node.textContent, /05:00/)

  now = deadline - 60_000
  tick()
  assert.equal(toast.textContent, 'Queda 1 minuto de examen.')
  assert.match(node.querySelector('[aria-label="Tiempo restante de examen"]').className, /rose/)
})

test('the exam delivers once at zero and closes a pending dialog', () => {
  const { node, state, quiz, deadline } = mountExam()
  // Finishing with unanswered questions asks first; the clock can expire while
  // that dialog is open.
  goToLast(node, quiz.items.length)
  node.querySelector('[data-action="next"]').click()
  assert.ok(document.getElementById('quiz-confirm'))

  now = deadline
  tick()
  tick()

  assert.equal(state.finishes, 1)
  assert.equal(document.getElementById('quiz-confirm'), null)
  assert.ok(state.report)
})

test('a tab that wakes up after the deadline only reports the delivery', () => {
  toast.textContent = ''
  const { state, deadline } = mountExam()

  now = deadline + 60_000
  tick()

  assert.equal(state.finishes, 1)
  assert.equal(toast.textContent, 'Se acabó el tiempo: el examen se entrega solo.')
})

test('marking an option reports progress so the exam can be saved', () => {
  const { node, state } = mountExam()
  node.querySelector('[data-option], [role="checkbox"]').click()
  assert.equal(state.progress, 1)
})

// --- results ---------------------------------------------------------------
const reportFor = (mode) => {
  const quiz = createQuiz({ pool: FULL_POOL, size: 5 })
  quiz.items.forEach((question, index) => quiz.select(index, index === 0 ? question.answer : []))
  return { report: quiz.report(), config: { size: 5, topics: ALL_TOPICS, mode } }
}

const mountResult = ({ report, config }) => {
  const node = document.createElement('div')
  mountResults(node, {
    report,
    config,
    onDownload: () => {},
    onRetry: () => {},
    onRetryFailed: () => {},
    onNew: () => {},
  })
  return node
}

test('an exam result drops every repeat action', () => {
  const exam = mountResult(reportFor('exam'))
  const practice = mountResult(reportFor('practice'))

  assert.equal(exam.querySelectorAll('[data-action="retry"]').length, 0)
  assert.equal(exam.querySelectorAll('[data-action="retry-failed"]').length, 0)
  assert.equal(practice.querySelectorAll('[data-action="retry"]').length, 1)
  assert.equal(practice.querySelectorAll('[data-action="retry-failed"]').length, 1)
})

test('the exam result keeps the download action and labels the mode', () => {
  const exam = mountResult(reportFor('exam'))
  assert.equal(exam.querySelectorAll('[data-action="download"]').length, 1)
  assert.ok(exam.textContent.includes('Examen'))
})

// --- stats -----------------------------------------------------------------
test('the stats dialog filters practice and exam attempts', () => {
  const quiz = createQuiz({ pool: FULL_POOL, size: 5 })
  quiz.items.forEach((question, index) => quiz.select(index, question.answer))

  Stats.record(Stats.toAttempt(quiz.report(), 'full', now))
  Stats.record(Stats.toAttempt(quiz.report(), 'exam', now + 1))

  openStats()
  const dialog = document.getElementById('stats-dialog')
  assert.ok(dialog)

  const testsCard = () => dialog.querySelectorAll('div').find((node) => node.children.length && node.children[0].textContent === 'Tests')
  assert.equal(testsCard().children[1].textContent, '2')

  dialog.querySelector('[data-filter="exam"]').click()
  assert.equal(testsCard().children[1].textContent, '1')

  dialog.querySelector('[data-filter="all"]').click()
  assert.equal(testsCard().children[1].textContent, '2')
})
