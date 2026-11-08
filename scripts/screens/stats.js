// Statistics dialog: reads the local attempt history and renders the trend,
// the answer mix, the practiced rules and the per-attempt record.
import { questions } from '../data.js'
import { closeButton, open as openDialog } from '../dialog.js'
import { append, el, icon, reducedMotion, toast } from '../render.js'
import { MODES, all, byRule, clear, exportJson, summary, trend } from '../stats.js'

const TONE = {
  improved: {
    icon: 'check',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    surface: 'border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20',
  },
  worsened: {
    icon: 'x',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
    bar: 'bg-rose-500',
    surface: 'border-rose-200/70 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20',
  },
  stable: {
    icon: 'dash',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
    bar: 'bg-slate-400',
    surface: 'border-slate-200/80 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40',
  },
  insufficient: {
    icon: 'dash',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
    bar: 'bg-slate-400',
    surface: 'border-slate-200/80 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40',
  },
}

const TREND_LABELS = {
  improved: 'Mejorando',
  worsened: 'Empeorando',
  stable: 'Estable',
  insufficient: 'Aún sin tendencia',
}

const TREND_SEGMENTS = [
  { key: 'correct', tone: 'bg-emerald-500' },
  { key: 'partial', tone: 'bg-amber-500' },
  { key: 'wrong', tone: 'bg-rose-500' },
  { key: 'unanswered', tone: 'bg-slate-400' },
]

const COUNT_ROWS = [
  { key: 'correct', label: 'Acertadas', tone: 'bg-emerald-500' },
  { key: 'partial', label: 'Parciales', tone: 'bg-amber-500' },
  { key: 'wrong', label: 'Falladas', tone: 'bg-rose-500' },
  { key: 'unanswered', label: 'Sin responder', tone: 'bg-slate-400' },
]

const pct = (value) => `${value}%`

const shortDate = (timestamp) => new Date(timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })

const bar = (value, toneClass) => {
  const width = Math.max(0, Math.min(100, value))
  return el(
    'div',
    { class: 'h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800' },
    el('div', { class: `h-full rounded-full ${toneClass}`, style: { width: `${width}%` } }),
  )
}

const card = (label, value, hint) =>
  el(
    'div',
    { class: 'rounded-md border border-slate-200/80 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800/60' },
    el('p', { class: 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400', text: label }),
    el('p', { class: 'mt-1 font-display text-2xl font-bold leading-none tabular-nums text-ink dark:text-slate-100', text: value }),
    hint ? el('p', { class: 'mt-1.5 text-[11px] leading-tight text-slate-500 dark:text-slate-400', text: hint }) : null,
  )

const sectionTitle = (text) => el('h3', { class: 'font-display text-sm font-semibold text-ink dark:text-slate-100', text })

const verdictText = (data) => {
  const { counts } = data
  if (!counts.correct && !counts.wrong) return 'Todavía no hay respuestas clasificadas.'
  if (counts.correct > counts.wrong) return 'Vas por delante: más aciertos que fallos.'
  if (counts.correct === counts.wrong) return 'Aciertos y fallos empatan.'
  return 'Los fallos pesan más que los aciertos.'
}

const verdictTone = (data) => {
  const { counts } = data
  if (counts.correct > counts.wrong) return 'text-emerald-700 dark:text-emerald-300'
  if (counts.correct === counts.wrong) return 'text-slate-600 dark:text-slate-300'
  return 'text-rose-700 dark:text-rose-300'
}

const trendBlock = (data) => {
  const tone = TONE[data.direction] || TONE.insufficient
  const delta =
    data.direction === 'insufficient'
      ? 'Completa al menos dos tests para comparar.'
      : `${data.delta > 0 ? '+' : ''}${data.delta} pts`
  const detail =
    data.direction === 'insufficient'
      ? 'La tendencia se calcula con los tests completos.'
      : `Últimos ${data.recentCount} tests: ${pct(data.recentPct)} · ${data.previousCount} anteriores: ${pct(data.previousPct)}`

  return el(
    'div',
    { class: `rounded-md border p-4 ${tone.surface}` },
    el(
      'div',
      { class: 'flex flex-wrap items-center justify-between gap-2' },
      sectionTitle('Tendencia'),
      el(
        'span',
        { class: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tone.badge}` },
        [icon(tone.icon, 'h-3.5 w-3.5'), TREND_LABELS[data.direction] || TREND_LABELS.insufficient],
      ),
    ),
    el('p', { class: 'mt-2 font-display text-2xl font-bold leading-none tabular-nums text-ink dark:text-slate-100', text: delta }),
    el('p', { class: 'mt-1 text-xs text-slate-500 dark:text-slate-400', text: detail }),
  )
}

const stackedBar = (counts, total) => {
  if (!total) return null
  return el(
    'div',
    { class: 'mt-3 flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800', 'aria-hidden': 'true' },
    TREND_SEGMENTS.filter((segment) => (counts[segment.key] || 0) > 0).map((segment) =>
      el('span', {
        class: `h-full ${segment.tone}`,
        style: { width: `${(counts[segment.key] / total) * 100}%` },
      }),
    ),
  )
}

const countsBlock = (data) => {
  const total = data.questions

  return el(
    'div',
    { class: 'rounded-md border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60' },
    sectionTitle('Aciertos vs errores'),
    el('p', { class: `mt-2 text-sm font-semibold ${verdictTone(data)}`, text: verdictText(data) }),
    stackedBar(data.counts, data.questions),
    el(
      'ul',
      { class: 'mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5' },
      COUNT_ROWS.map((row) => {
        const count = data.counts[row.key] || 0
        const share = total ? (count / total) * 100 : 0
        return el(
          'li',
          { class: 'flex items-center justify-between gap-2 text-xs' },
          el(
            'span',
            { class: 'inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200' },
            [el('span', { class: `h-2 w-2 shrink-0 rounded-full ${row.tone}` }), row.label],
          ),
          el('span', { class: 'tabular-nums text-slate-500 dark:text-slate-400', text: `${count} · ${Math.round(share)}%` }),
        )
      }),
    ),
    el('p', { class: 'mt-3 text-[11px] text-slate-500 dark:text-slate-400', text: 'Parciales y sin responder se informan aparte y no entran en el veredicto.' }),
  )
}

const historyBlock = (attempts) => {
  const recent = attempts.slice(-8).reverse()
  return el(
    'div',
    { class: 'rounded-md border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60' },
    sectionTitle('Últimos tests'),
    el(
      'ul',
      { class: 'mt-3 space-y-2' },
      recent.map((attempt) => {
        const retry = attempt.mode === MODES.retry
        return el(
          'li',
          { class: 'flex items-center gap-3' },
          el('span', { class: 'w-14 shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-slate-400', text: shortDate(attempt.at) }),
          el('div', { class: 'min-w-0 flex-1' }, bar(attempt.pct, attempt.passed ? 'bg-emerald-500' : 'bg-rose-500')),
          el('span', {
            class: `w-14 shrink-0 text-right text-xs font-semibold tabular-nums ${attempt.passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`,
            text: pct(attempt.pct),
          }),
          retry
            ? el('span', { class: 'shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300', text: 'repaso' })
            : el('span', { class: 'w-0 shrink-0' }),
        )
      }),
    ),
  )
}

const accuracyTone = (accuracy) => {
  if (accuracy >= 75) return 'text-emerald-700 dark:text-emerald-300'
  if (accuracy >= 50) return 'text-amber-700 dark:text-amber-300'
  return 'text-rose-700 dark:text-rose-300'
}

const weakestNote = (weakest) => {
  if (!weakest) {
    return el('p', { class: 'mt-1 text-xs text-slate-500 dark:text-slate-400', text: 'Aún no hay reglas con suficientes preguntas para señalar un punto débil.' })
  }
  return el(
    'p',
    { class: 'mt-1 text-xs text-slate-500 dark:text-slate-400' },
    [
      'Punto débil: ',
      el('strong', { class: 'font-semibold text-rose-700 dark:text-rose-300', text: weakest.label }),
      ` · ${pct(weakest.accuracy)} en ${weakest.seen} preguntas`,
    ],
  )
}

const rulesBlock = (ruleData) => {
  const { mostPracticed: top, weakest } = ruleData

  if (!top) {
    return el(
      'div',
      { class: 'rounded-md border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60' },
      sectionTitle('Reglas más trabajadas'),
      el('p', { class: 'mt-2 text-xs text-slate-500 dark:text-slate-400', text: 'Todavía no hay preguntas registradas.' }),
    )
  }

  const rows = ruleData.rules.slice(0, 6)

  return el(
    'div',
    { class: 'rounded-md border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60' },
    sectionTitle('Reglas más trabajadas'),
    el(
      'p',
      { class: 'mt-2 text-sm text-slate-700 dark:text-slate-200' },
      [
        'La que más has practicado: ',
        el('strong', { class: 'font-semibold text-ink dark:text-slate-100', text: top.label }),
        ' · ',
        `${top.seen} preguntas · `,
        el('span', { class: `${accuracyTone(top.accuracy)} font-semibold`, text: `${pct(top.accuracy)} de acierto` }),
      ],
    ),
    weakestNote(weakest),
    el(
      'ul',
      { class: 'mt-3 divide-y divide-slate-100 dark:divide-slate-700' },
      rows.map((group) =>
        el(
          'li',
          { class: 'flex items-center justify-between gap-3 py-1.5 text-xs' },
          el('span', { class: 'font-medium text-slate-700 dark:text-slate-200', text: group.label }),
          el('span', { class: 'tabular-nums text-slate-500 dark:text-slate-400', text: `${group.seen} preg.` }),
          el('span', { class: `w-16 text-right font-semibold tabular-nums ${accuracyTone(group.accuracy)}`, text: pct(group.accuracy) }),
        ),
      ),
    ),
  )
}

const download = (attempts) => {
  const blob = new Blob([exportJson(attempts)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = el('a', {
    href: url,
    download: `ihf-estadisticas-${new Date().toISOString().slice(0, 10)}.json`,
  })
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  toast('Estadísticas exportadas')
}

export const open = ({ onCleared } = {}) => {
  if (document.getElementById('stats-dialog')) return

  const attempts = all()
    .slice()
    .sort((a, b) => a.at - b.at)
  if (!attempts.length) return

  const questionsById = {}
  questions().forEach((question) => {
    questionsById[question.id] = question
  })

  const summaryData = summary(attempts)
  const trendData = trend(attempts)
  const ruleData = byRule(attempts, questionsById)

  let closeTimer = null
  let confirmingClear = false
  let handle = null

  const closeControl = closeButton(() => {
    if (handle) handle.close()
  })

  const clearButton = el('button', {
    type: 'button',
    class:
      'inline-flex items-center justify-center gap-2 rounded border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 active:translate-y-px dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60',
    on: {
      click: () => {
        if (!confirmingClear) {
          confirmingClear = true
          clearButton.textContent = 'Confirmar borrado'
          closeTimer = setTimeout(resetClear, 5000)
          return
        }
        if (closeTimer) clearTimeout(closeTimer)
        clear()
        if (handle) handle.close()
        toast('Historial de estadísticas borrado')
        if (typeof onCleared === 'function') onCleared()
      },
    },
    kids: [icon('x', 'h-3.5 w-3.5'), el('span', { text: 'Borrar historial' })],
  })

  const resetClear = () => {
    confirmingClear = false
    clearButton.textContent = ''
    append(clearButton, [icon('x', 'h-3.5 w-3.5'), el('span', { text: 'Borrar historial' })])
  }

  const exportButton = el('button', {
    type: 'button',
    class:
      'inline-flex items-center justify-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 active:translate-y-px dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
    on: { click: () => download(attempts) },
    kids: [icon('download', 'h-3.5 w-3.5'), 'Exportar JSON'],
  })

  // Sticky: the dialog is the scroll container, so the way out stays
  // reachable no matter how far the history scrolls.
  const header = el(
    'div',
    { class: 'sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-5 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:px-6' },
    el(
      'div',
      { class: 'flex min-w-0 items-start gap-3' },
      el('span', {
        class: 'grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200',
        kids: [icon('chart', 'h-5 w-5')],
      }),
      el(
        'div',
        { class: 'min-w-0' },
        el('p', { class: 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400', text: 'Progreso de estudio' }),
        el('h2', { id: 'stats-title', class: 'mt-0.5 font-display text-xl font-semibold text-ink dark:text-slate-100', text: 'Tus estadísticas' }),
        el('p', { class: 'mt-1 text-xs text-slate-500 dark:text-slate-400', text: 'Guardadas en este navegador. No se sincronizan entre dispositivos.' }),
      ),
    ),
    closeControl,
  )

  const body = el('div', { class: 'px-5 py-4 sm:px-6 sm:py-5' }, [
    el(
      'div',
      { class: 'grid grid-cols-2 gap-3 sm:grid-cols-4' },
      [
        card('Tests', String(summaryData.attempts), `${summaryData.questions} preguntas`),
        card('Media', pct(summaryData.averagePct), 'del total'),
        card('Mejor', pct(summaryData.bestPct), 'hasta ahora'),
        card('Aprobados', `${summaryData.passed} de ${summaryData.attempts}`, '≥75%'),
      ],
    ),
    el('div', { class: 'mt-3 space-y-3' }, [trendBlock(trendData), countsBlock(summaryData), historyBlock(attempts), rulesBlock(ruleData)]),
    el(
      'div',
      { class: 'mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-700' },
      el('p', { class: 'text-[11px] text-slate-500 dark:text-slate-400', text: 'Exporta una copia antes de borrar: el historial solo vive en este navegador.' }),
      el('div', { class: 'flex flex-wrap gap-2' }, [exportButton, clearButton]),
    ),
  ])

  handle = openDialog({
    id: 'stats-dialog',
    labelledBy: 'stats-title',
    initialFocus: closeControl,
    className: `max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-md border border-slate-200/80 bg-white shadow-lift dark:border-slate-700 dark:bg-slate-900 sm:rounded-md${reducedMotion() ? '' : ' animate-pop-in'}`,
    children: [header, body],
    onClose: () => {
      if (closeTimer) clearTimeout(closeTimer)
    },
  })
}
