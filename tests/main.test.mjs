import test from 'node:test'
import assert from 'node:assert/strict'
import { installFakeDom, seedToast } from './helpers/fake-dom.mjs'

// Boots the real main.js on a fake DOM: the exam flow from the setup button
// through the briefing, the saved session and the exit path.

const { document } = installFakeDom()
seedToast(document)

const screen = (id, className = 'screen') => {
  const node = document.createElement('div')
  node.setAttribute('id', id)
  if (className) node.className = className
  document.body.appendChild(node)
  return node
}

const setup = screen('screen-setup', 'screen')
const quizScreen = screen('screen-quiz', 'screen hidden')
screen('screen-results', 'screen hidden')
document.body.appendChild(setup)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (root, selector, tries = 80) => {
  for (let i = 0; i < tries; i++) {
    const el = root.querySelector(selector)
    if (el) return el
    await wait(50)
  }
  return null
}

const { load, questions } = await import('../scripts/data.js')
await load()
await import('../scripts/main.js')
document.dispatch('DOMContentLoaded')

const click = (root, selector) => {
  const el = root.querySelector(selector)
  assert.ok(el, `missing ${selector}`)
  el.click()
}

test('starting an exam asks for the rules before mounting the quiz', async () => {
  const examMode = await waitFor(setup, '[data-mode="exam"]')
  assert.ok(examMode, 'setup mounted')
  examMode.click()
  click(setup, '[data-action="start"]')
  await wait(200)

  assert.ok(document.getElementById('exam-briefing'), 'briefing first')
  assert.ok(quizScreen.classList.contains('hidden'), 'quiz still hidden')
  assert.equal(localStorage.getItem('ihf.exam.v1'), null)
})

test('confirming the briefing mounts the quiz and saves the session', async () => {
  click(document.getElementById('exam-briefing'), '[data-action="confirm-exam"]')

  const option = await waitFor(quizScreen, '[role="checkbox"]')
  assert.ok(option, 'quiz mounted')
  assert.ok(!quizScreen.classList.contains('hidden'))

  const saved = JSON.parse(localStorage.getItem('ihf.exam.v1'))
  assert.ok(saved, 'session saved')
  assert.equal(saved.config.mode, 'exam')
  assert.equal(saved.questionIds.length, 30)
  assert.equal(saved.selected.length, 30)
})

test('answering updates the saved session', async () => {
  const option = quizScreen.querySelector('[role="checkbox"]')
  option.click()
  await wait(80)

  const saved = JSON.parse(localStorage.getItem('ihf.exam.v1'))
  assert.equal(saved.selected.filter((letters) => letters.length).length, 1)
})

test('leaving the exam clears the session and offers no resume banner', async () => {
  click(quizScreen, '[data-action="exit"]')
  await wait(80)
  const confirm = document.getElementById('quiz-confirm')
  assert.ok(confirm, 'exit asks first')
  confirm.querySelector('button.bg-rose-600').click()
  await wait(400)

  assert.equal(localStorage.getItem('ihf.exam.v1'), null)
  assert.ok(setup.classList.contains('hidden') === false, 'back on the setup')

  document.dispatch('DOMContentLoaded')
  await wait(200)
  assert.doesNotMatch(setup.textContent, /Tienes un examen a medias/)
})

test('a saved exam is offered on boot and resumes into the quiz', async () => {
  // The previous attempt left its own DOM in the quiz screen: clear it so the
  // assertions below can only pass with a freshly mounted quiz.
  quizScreen.textContent = ''
  const bank = questions()
  const first = bank[0]
  const second = bank[1]
  const deadline = Date.now() + 20 * 60 * 1000
  localStorage.setItem(
    'ihf.exam.v1',
    JSON.stringify({
      v: 1,
      tab: 'test-tab',
      config: { topics: ['1'], size: 5, mode: 'exam' },
      deadline,
      questionIds: [first.id, second.id],
      selected: [first.answer.slice(), []],
    }),
  )

  document.dispatch('DOMContentLoaded')
  await wait(200)

  assert.match(setup.textContent, /Tienes un examen a medias/)
  click(setup, '[data-action="resume-exam"]')

  const option = await waitFor(quizScreen, '[role="checkbox"]')
  assert.ok(option, 'resumed into the quiz')
  assert.equal(setup.classList.contains('hidden'), true)
  assert.match(quizScreen.textContent, /1 de 2 respondidas/, 'the saved answer came back')
})

test('leaving a resumed exam clears it too', async () => {
  click(quizScreen, '[data-action="exit"]')
  await wait(80)
  const confirm = document.getElementById('quiz-confirm')
  assert.ok(confirm, 'exit asks first')
  confirm.querySelector('button.bg-rose-600').click()
  await wait(400)

  assert.equal(localStorage.getItem('ihf.exam.v1'), null)
})
