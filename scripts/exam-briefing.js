import { el, icon } from './render.js'
import { open as openDialog } from './dialog.js'
import { EXAM } from './timer.js'

// The only moment the exam conditions are shown, so it carries the scoring
// rules, the time limit and what happens when the clock runs out. Every exam
// launch goes through here, including the repeat-test button.

export const EXAM_RULES = [
  'Las preguntas pueden tener varias respuestas.',
  'Cada respuesta correcta marcada suma un punto (+1).',
  'Cada respuesta errónea marcada resta un punto (−1).',
  'Las respuestas correctas que no marques no suman ni restan (0).',
]

export const openBriefing = (onConfirm) => {
  let dialog = null
  const startButton = el('button', {
    type: 'button',
    'data-action': 'confirm-exam',
    class:
      'inline-flex items-center justify-center gap-2 rounded bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lift transition hover:-translate-y-0.5 active:translate-y-0 active:brightness-95',
    on: {
      click: () => {
        dialog?.close()
        onConfirm()
      },
    },
    kids: ['Empezar examen', icon('right', 'h-4 w-4')],
  })
  const cancelButton = el('button', {
    type: 'button',
    class:
      'rounded border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
    on: { click: () => dialog?.close() },
    text: 'Cancelar',
  })

  dialog = openDialog({
    id: 'exam-briefing',
    labelledBy: 'exam-briefing-title',
    className: 'w-full max-w-md rounded-md bg-white p-6 shadow-lift animate-pop-in dark:bg-slate-900',
    children: [
      el('h2', {
        id: 'exam-briefing-title',
        class: 'font-display text-xl font-bold text-ink',
        text: 'Modo examen',
      }),
      el('p', {
        class: 'mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300',
        text: `${EXAM.size} preguntas · ${EXAM.seconds / 60} minutos · sin pistas. Se corrige así:`,
      }),
      el(
        'ul',
        { class: 'mt-3 space-y-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300' },
        EXAM_RULES.map((rule) => el('li', { class: 'flex gap-2' }, el('span', { class: 'text-brand-600', text: '•' }), rule)),
      ),
      el('p', {
        class: 'mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200',
        text: 'Avisos a los 5 minutos y al último minuto. Cuando el tiempo llegue a cero el examen se entrega solo, y lo que dejes en blanco no suma: la cuenta de puntos se queda como está.',
      }),
      el('div', { class: 'mt-5 flex flex-wrap justify-end gap-3' }, [cancelButton, startButton]),
    ],
    initialFocus: startButton,
  })

  return dialog
}
