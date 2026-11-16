import { topicLabel } from '../data.js'
import { create as createHint } from '../hint.js'
import { el, icon, mount as mountChildren, reducedMotion, toast } from '../render.js'
import { WARNING_THRESHOLDS, formatClock, remainingSeconds, warningDue, warningText } from '../timer.js'
import { open as openDialog } from '../dialog.js'

const PILL_CLASS = 'h-11 min-w-[44px] rounded px-2 text-xs font-bold transition sm:h-8 sm:min-w-[32px]'

const TIMER_BASE = 'inline-flex items-center gap-2 rounded border px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors'

// Amber at five minutes, red at the last one: the pair of warnings the exam
// announces, so the colour and the toast never disagree.
const timerTone = (level) => {
  if (level === 'danger') return 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
  if (level === 'warn') return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  return 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200'
}

const openConfirm = ({ title, message, cancelText, confirmText, danger, onConfirm }) => {
  let dialog = null
  const cancelButton = el('button', {
    type: 'button',
    class:
      'rounded border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
    on: { click: () => dialog?.close() },
    text: cancelText || 'Cancelar',
  })
  const confirmButton = el('button', {
    type: 'button',
    class: `rounded px-4 py-2 text-sm font-semibold text-white transition ${danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-brand-600 hover:bg-brand-500'}`,
    on: {
      click: () => {
        dialog?.close()
        onConfirm()
      },
    },
    text: confirmText,
  })

  // One dialog implementation for the whole app: focus trap, Escape and scroll
  // lock live in dialog.js.
  dialog = openDialog({
    id: 'quiz-confirm',
    labelledBy: 'quiz-confirm-title',
    className: 'w-full max-w-sm rounded-md bg-white p-6 shadow-lift animate-pop-in dark:bg-slate-900',
    children: [
      el('h3', { id: 'quiz-confirm-title', class: 'font-display text-lg font-semibold text-ink', text: title }),
      el('p', { class: 'mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300', text: message }),
      el('div', { class: 'mt-5 flex flex-wrap justify-end gap-3' }, [cancelButton, confirmButton]),
    ],
    initialFocus: cancelButton,
  })

  return () => dialog?.close()
}

export const mount = (node, { quiz, onFinish, onExit, onProgress, mode = 'practice', deadline = null }) => {
  const total = quiz.items.length
  const startTime = Date.now()
  const exam = mode === 'exam' && Number.isFinite(deadline)
  let index = 0
  let timerInterval = null
  let delivered = false
  let activeConfirm = null
  let firedWarnings = []

  const fill = el('div', { class: 'progress-fill h-full rounded-full', style: { width: '0%' } })
  const counter = el('span', { class: 'font-display text-sm font-semibold text-ink' })
  const answeredLabel = el('span', { class: 'text-xs font-medium text-slate-500' })
  const timerTextSpan = el('span', { class: 'font-display font-semibold tracking-normal text-xs' })
  // Warnings are announced once each; the ticking clock itself stays silent so
  // a screen reader is not read the time every second.
  const timerStatus = el('span', { class: 'sr-only', role: 'status', 'aria-live': 'polite' })
  const timerLabel = el('span', {
    class: `${TIMER_BASE} ${timerTone('neutral')}`,
    'aria-label': exam ? 'Tiempo restante de examen' : 'Tiempo transcurrido',
    kids: [icon('clock', 'h-4 w-4 shrink-0'), timerTextSpan],
  })
  const pills = el('div', { class: 'flex flex-wrap gap-1.5' })
  const cardHost = el('div', { class: 'mt-4' })
  const pillClasses = []
  const pillCurrent = []
  let pillNodes = []
  let prevButton
  let nextButton
  let nextLabel
  let questionHeading = null

  const clearTimer = () => {
    if (!timerInterval) return
    clearInterval(timerInterval)
    timerInterval = null
  }

  // A reload mid-exam would throw the attempt away: the browser asks first.
  const guardUnload = exam
    ? (event) => {
      if (delivered) return
      event.preventDefault()
      event.returnValue = ''
    }
    : null
  if (guardUnload) {
    window.addEventListener('beforeunload', guardUnload)
    document.body.dataset.exam = 'on'
  }

  const teardown = () => {
    clearTimer()
    if (!guardUnload) return
    window.removeEventListener('beforeunload', guardUnload)
    delete document.body.dataset.exam
  }

  // One delivery per attempt: the manual finish and the clock expiry share it,
  // and a late tick cannot submit twice.
  const deliver = () => {
    if (delivered) return
    delivered = true
    clearTimer()
    if (activeConfirm) {
      const close = activeConfirm
      activeConfirm = null
      close()
    }
    teardown()
    onFinish(quiz.report())
  }

  const setTimerTone = (level) => {
    const cls = `${TIMER_BASE} ${timerTone(level)}`
    if (timerLabel.className !== cls) timerLabel.className = cls
  }

  const updateTimer = () => {
    if (!exam) {
      const elapsed = Math.min(Math.floor((Date.now() - startTime) / 1000), 3599) // Cap at 59:59
      const text = formatClock(elapsed)
      if (timerTextSpan.textContent !== text) timerTextSpan.textContent = text
      return
    }

    const left = remainingSeconds(deadline, Date.now())
    const text = formatClock(left)
    if (timerTextSpan.textContent !== text) timerTextSpan.textContent = text
    setTimerTone(left <= 60 ? 'danger' : left <= WARNING_THRESHOLDS[0] ? 'warn' : 'neutral')

    // At zero the delivery toast is the only message: a sleeping tab must not
    // announce "one minute left" at the same instant.
    const warning = left > 0 ? warningDue(left, firedWarnings) : null
    if (warning) {
      // A late tick that skipped the five minute mark only announces the
      // tighter one, never both in a row.
      firedWarnings = WARNING_THRESHOLDS.filter((threshold) => threshold >= warning)
      const copy = warningText(warning)
      toast(copy)
      timerStatus.textContent = copy
    }

    if (left <= 0) {
      toast('Se acabó el tiempo: el examen se entrega solo.')
      deliver()
    }
  }

  timerInterval = setInterval(updateTimer, 1000)
  updateTimer()

  const answeredCount = () => quiz.answeredCount()

  // Writes only what changed so option clicks do not touch the whole chrome.
  const setText = (target, value) => {
    if (target.textContent !== value) target.textContent = value
  }

  const pillClass = (current, done) =>
    `${PILL_CLASS}${
      current
        ? ' bg-brand-600 text-white shadow-card'
        : done
          ? ' bg-brand-100 text-brand-700 hover:bg-brand-200'
          : ' bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`

  const syncChrome = () => {
    const width = `${((index + 1) / total) * 100}%`
    if (fill.style.width !== width) fill.style.width = width
    setText(counter, `Pregunta ${index + 1} / ${total}`)
    setText(answeredLabel, `${answeredCount()} de ${total} respondidas`)
    pillNodes.forEach((pill, i) => {
      const current = i === index
      const cls = pillClass(current, quiz.selected(i).length > 0)
      if (pillClasses[i] !== cls) {
        pillClasses[i] = cls
        pill.className = cls
      }
      const aria = current ? 'step' : 'false'
      if (pillCurrent[i] !== aria) {
        pillCurrent[i] = aria
        pill.setAttribute('aria-current', aria)
      }
    })
    const atStart = index === 0
    if (prevButton && prevButton.disabled !== atStart) prevButton.disabled = atStart
    setText(nextLabel, index === total - 1 ? (exam ? 'Finalizar examen' : 'Finalizar test') : 'Siguiente')
    const last = index === total - 1
    nextButton.classList.toggle('from-emerald-500', last)
    nextButton.classList.toggle('to-emerald-400', last)
    nextButton.classList.toggle('from-brand-600', !last)
    nextButton.classList.toggle('to-brand-500', !last)
  }

  const optionClass = (on) =>
    `option flex w-full items-center gap-3 rounded border px-4 py-3.5 text-left ${
      on
        ? 'border-brand-500 bg-brand-50/80 shadow-card ring-1 ring-brand-500 dark:border-brand-500 dark:bg-brand-900/40'
        : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60'
    }`

  const checkBoxClass = (on) =>
    `grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition ${
      on ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-transparent dark:border-slate-600'
    }`

  const letterClass = (on) =>
    `option-letter grid h-7 w-7 shrink-0 place-items-center rounded text-xs font-bold transition ${
      on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
    }`

  const renderQuestion = () => {
    const question = quiz.items[index]
    const letters = quiz.selected(index)
    const hint = exam ? null : createHint(question)

    const optionNodes = question.options.map((opt) => {
      const on = letters.includes(opt.letter)
      const boxIcon = icon('check', 'h-3.5 w-3.5 text-white')
      boxIcon.style.opacity = on ? '1' : '0'
      const box = el('span', { class: checkBoxClass(on), kids: [boxIcon] })
      const optionButton = el(
        'button',
        {
          type: 'button',
          role: 'checkbox',
          'aria-checked': String(on),
          'data-letter': opt.letter,
          class: optionClass(on),
          on: {
            click: () => {
              const current = quiz.selected(index)
              const next = current.includes(opt.letter)
                ? current.filter((letter) => letter !== opt.letter)
                : current.concat(opt.letter).sort()
              quiz.select(index, next)
              if (onProgress) onProgress()
              const checked = next.includes(opt.letter)
              optionButton.setAttribute('aria-checked', String(checked))
              optionButton.className = optionClass(checked)
              optionButton.querySelector('.option-letter').className = letterClass(checked)
              box.className = checkBoxClass(checked)
              boxIcon.style.opacity = checked ? '1' : '0'
              syncChrome()
            },
          },
        },
        el('span', { class: letterClass(on), text: opt.letter }),
        el('span', { class: 'flex-1 text-sm leading-relaxed text-slate-700', text: opt.text }),
        box,
      )
      return optionButton
    })

    // The question is the screen's title: display face, one clear weight step
    // above the option copy (which stays in the body face).
    questionHeading = el('h2', {
      id: 'quiz-question',
      tabindex: '-1',
      class:
        'mt-5 max-w-[70ch] font-display text-lg font-semibold leading-snug text-ink outline-none sm:text-xl',
      text: question.text,
    })

    const card = el(
      'article',
      {
        class: 'rounded-md border border-slate-200/80 bg-white p-5 shadow-card sm:p-6 animate-fade-up',
        'data-qid': question.id,
      },
      el(
        'div',
        { class: 'flex flex-wrap items-center justify-between gap-3' },
        el(
          'div',
          { class: 'flex flex-wrap items-center gap-2' },
          el('span', {
            class: 'rounded bg-brand-600 px-2 py-1 font-display text-xs font-bold text-white',
            text: question.id,
          }),
          el('span', {
            class: 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600',
            text: topicLabel(question.topic),
          }),
        ),
        exam ? null : hint.button,
      ),
      questionHeading,
      el('p', {
        class: 'mt-3 text-xs font-medium text-slate-500',
        text: 'Marca todas las respuestas correctas. Puede haber más de una.',
      }),
      el('div', { class: 'mt-3 space-y-3', role: 'group', 'aria-labelledby': 'quiz-question', kids: optionNodes }),
      exam ? null : hint.panel,
    )

    mountChildren(cardHost, card)
    syncChrome()
    // Move the reading position to the new question and announce it without a
    // second scroll: the explicit scroll below owns the movement.
    questionHeading.focus({ preventScroll: true })
  }

  const go = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= total) return
    index = nextIndex
    renderQuestion()
    // On phones the "Siguiente" control sits in a sticky bar at the bottom;
    // without this the next question would open already scrolled past.
    const top = Math.max(node.getBoundingClientRect().top + window.scrollY - 8, 0)
    window.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  const finish = () => {
    const pending = total - answeredCount()
    if (pending > 0) {
      const unansweredList = []
      for (let i = 0; i < total; i++) {
        if (quiz.selected(i).length === 0) unansweredList.push(i + 1)
      }
      const listStr = `${unansweredList.slice(0, 5).join(', ')}${unansweredList.length > 5 ? '...' : ''}`
      activeConfirm = openConfirm({
        title: 'Faltan preguntas por responder',
        message: `Tienes ${pending}${pending === 1 ? ' pregunta sin responder' : ' preguntas sin responder'} (${listStr}). Puedes terminar igualmente: lo que dejes en blanco no suma puntos.`,
        confirmText: 'Terminar igualmente',
        danger: true,
        onConfirm: () => {
          activeConfirm = null
          deliver()
        },
      })
      return
    }
    deliver()
  }

  const exit = () => {
    if (answeredCount() > 0) {
      activeConfirm = openConfirm({
        title: 'Salir del test',
        message: exam ? 'Perderás las respuestas y el tiempo de este examen. ¿Quieres salir?' : 'Perderás las respuestas de este intento. ¿Quieres salir?',
        confirmText: 'Salir',
        danger: true,
        onConfirm: () => {
          activeConfirm = null
          teardown()
          onExit()
        },
      })
      return
    }
    teardown()
    onExit()
  }

  const topbar = el(
    'div',
    { class: 'rounded-md border border-slate-200/80 bg-white p-4 shadow-card sm:p-5' },
    el(
      'div',
      { class: 'flex flex-wrap items-center justify-between gap-3' },
      el('button', {
        type: 'button',
        class:
          'inline-flex items-center gap-1.5 rounded border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-600',
        'data-action': 'exit',
        on: { click: exit },
        kids: [icon('close', 'h-4 w-4'), 'Salir'],
      }),
      el('div', { class: 'flex items-center gap-3' }, timerLabel, counter, timerStatus),
      answeredLabel,
    ),
    el('div', { class: 'mt-3 h-2 overflow-hidden rounded-full bg-slate-100' }, fill),
    el('div', { class: 'mt-3 flex items-center justify-between gap-3' }, pills),
  )

  pillNodes = quiz.items.map((question, i) =>
    el('button', {
      type: 'button',
      'data-pill': String(i + 1),
      'aria-label': `Ir a la pregunta ${i + 1}`,
      class: PILL_CLASS,
      text: String(i + 1),
      title: `Pregunta ${i + 1}`,
      on: {
        click: () => go(i),
      },
    }),
  )
  pills.append(...pillNodes)

  prevButton = el('button', {
    type: 'button',
    'data-action': 'prev',
    class:
      'inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 active:translate-y-px disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white dark:disabled:text-slate-500',
    on: {
      click: () => go(index - 1),
    },
    kids: [icon('left', 'h-4 w-4'), 'Anterior'],
  })

  nextLabel = el('span', { text: 'Siguiente' })
  nextButton = el('button', {
    type: 'button',
    'data-action': 'next',
    class:
      'group inline-flex items-center gap-2 rounded bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lift transition hover:-translate-y-0.5 active:translate-y-0 active:brightness-95',
    on: {
      click: () => {
        if (index === total - 1) finish()
        else go(index + 1)
      },
    },
    kids: [nextLabel, icon('right', 'h-4 w-4 transition-transform group-hover:translate-x-0.5')],
  })

  const nav = el(
    'div',
    {
      class:
        'quiz-nav sticky bottom-3 z-30 mt-4 flex items-center justify-between gap-3 rounded-md border border-slate-200/80 bg-white/95 p-2 shadow-lift backdrop-blur dark:border-slate-700 dark:bg-slate-900/95',
    },
    prevButton,
    nextButton,
  )

  // The screen's only heading sits at h2 (the question); the page needs an h1
  // for its outline, but the topbar already carries the context visually.
  mountChildren(node, [
    el('h1', { class: 'sr-only', text: 'Test de preguntas de las Reglas de Juego' }),
    topbar,
    cardHost,
    nav,
  ])
  renderQuestion()
}
