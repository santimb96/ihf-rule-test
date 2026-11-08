/**
 * Results screen: pass/fail hero with an animated score ring, action bar
 * (PDF, retry, new test) and a filterable per-question review with hints.
 */
import { topicLabel, topics } from '../data.js'
import { create as createHint } from '../hint.js'
import { append, clear, el, icon, mount as mountChildren } from '../render.js'
import { STATUS } from '../scoring.js'

const CIRCUMFERENCE = 2 * Math.PI * 54

// Pill copy per classification. The classification itself is computed once in
// scoring.js, so the stats history and this screen can never disagree.
const STATUS_PILL = {
  correct: {
    label: 'Acertada',
    icon: 'check',
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  unanswered: {
    label: 'Sin responder',
    icon: 'dash',
    tone: 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-200',
  },
  wrong: {
    label: 'Fallada',
    icon: 'x',
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  },
  partial: {
    label: 'Parcial',
    icon: 'alert',
    tone: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200',
  },
}

// Option row states in the review list. "missed" is a correct answer the user
// never picked: amber with an alert so it never reads as a hit.
const OPTION_STATE = {
  hit: {
    tone: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/40',
    badge: 'bg-emerald-700 text-white',
    text: 'text-slate-800 dark:text-emerald-50',
    icon: 'check',
    iconCls: 'text-emerald-600 dark:text-emerald-300',
  },
  missed: {
    tone: 'border-amber-200 bg-amber-50/80 dark:border-amber-800/70 dark:bg-amber-950/40',
    badge: 'bg-amber-400 text-amber-950',
    text: 'text-slate-800 dark:text-amber-50',
    icon: 'alert',
    iconCls: 'text-amber-700 dark:text-amber-300',
  },
  wrong: {
    tone: 'border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/40',
    badge: 'bg-rose-700 text-white',
    text: 'text-slate-800 dark:text-rose-50',
    icon: 'x',
    iconCls: 'text-rose-600 dark:text-rose-300',
  },
  plain: {
    tone: 'border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40',
    badge: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
    text: 'text-slate-500 dark:text-slate-300',
    icon: null,
    iconCls: null,
  },
}

const PRIMARY_CLASS =
  'group inline-flex items-center justify-center gap-2 rounded bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lift transition hover:-translate-y-0.5 active:translate-y-0 active:brightness-95 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0'
const SECONDARY_CLASS =
  'inline-flex items-center justify-center gap-2 rounded border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 active:translate-y-px disabled:cursor-wait disabled:opacity-60'
const DANGER_CLASS =
  'inline-flex items-center justify-center gap-2 rounded border border-rose-300 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 active:translate-y-px dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60'

const reviewCard = (result) => {
  const question = result.question
  const hint = createHint(question, { subtle: true })
  const unanswered = result.selected.length === 0
  const status = STATUS_PILL[result.status] || STATUS_PILL[STATUS.unanswered]

  const optionRows = question.options.map((option) => {
    const inKey = question.answer.includes(option.letter)
    const picked = result.selected.includes(option.letter)
    const state = OPTION_STATE[inKey && picked ? 'hit' : inKey ? 'missed' : picked ? 'wrong' : 'plain']
    return el(
      'li',
      { class: `flex items-center gap-2.5 rounded border px-3 py-2 ${state.tone}` },
      el('span', {
        class: `grid h-6 w-6 shrink-0 place-items-center rounded text-[11px] font-bold ${state.badge}`,
        text: option.letter,
      }),
      el('span', { class: `flex-1 text-xs leading-relaxed ${state.text}`, text: option.text }),
      state.icon ? icon(state.icon, `h-4 w-4 shrink-0 ${state.iconCls}`) : null,
    )
  })

  // Answer comparison as tinted chips: the "yours" chip borrows the status
  // tone, so a partial sweep reads amber instead of red.
  const answerLine = el(
    'div',
    { class: 'mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800' },
    el('span', { class: 'inline-flex items-center gap-2' }, [
      el('span', { class: 'text-slate-500', text: 'Tu respuesta' }),
      el('span', {
        class: `rounded px-2 py-1 font-bold ${status.tone}`,
        text: unanswered ? 'sin responder' : result.selected.join(', '),
      }),
    ]),
    el('span', { class: 'inline-flex items-center gap-2' }, [
      el('span', { class: 'text-slate-500', text: 'Respuesta correcta' }),
      el('span', {
        class: 'rounded bg-emerald-100 px-2 py-1 font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
        text: question.answer.join(', '),
      }),
    ]),
  )

  return el(
    'article',
    {
      class: 'review-card relative rounded-md border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800',
    },
    el(
      'div',
      { class: '' },
      el(
        'div',
        { class: 'flex flex-wrap items-center justify-between gap-3' },
        el(
          'div',
          { class: 'flex flex-wrap items-center gap-2' },
          el('span', {
            class: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${status.tone}`,
            kids: [icon(status.icon, 'h-3.5 w-3.5'), status.label],
          }),
          el('span', { class: 'rounded bg-brand-600 px-1.5 py-0.5 font-display text-[11px] font-bold text-white', text: question.id }),
          el('span', {
            class: 'rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300',
            text: topicLabel(question.topic),
          }),
        ),
        hint.button,
      ),
      // Review questions are read, not scanned: ~60ch keeps lines under 80
      // characters instead of the ~92 the full card width gave.
      el('p', { class: 'mt-3 max-w-[60ch] text-sm font-medium leading-relaxed text-ink', text: question.text }),
      el('ul', { class: 'mt-3 space-y-2', kids: optionRows }),
      answerLine,
      hint.panel,
    ),
  )
}

export const mount = (node, options) => {
  const { report, config, onDownload, onRetry, onRetryFailed, onNew } = options
  const failedCount = report.results.filter((result) => !result.correct).length
  // A failed attempt opens on its misses: reviewing them is the study moment.
  let filter = report.passed ? 'all' : 'failed'

  const ringStroke = el('circle', {
    class: `ring-progress ${report.passed ? 'stroke-emerald-600 dark:stroke-emerald-400' : 'stroke-rose-600 dark:stroke-rose-400'}`,
    cx: '60',
    cy: '60',
    r: '54',
    fill: 'none',
    'stroke-width': '10',
    'stroke-linecap': 'round',
    'stroke-dasharray': String(CIRCUMFERENCE),
    'stroke-dashoffset': String(CIRCUMFERENCE),
  })

  const listHost = el('div', { class: 'review-list space-y-3' })
  const tabNodes = []
  const cards = []
  let shown = {}

  const matches = (result) => {
    if (filter === 'correct') return result.correct
    if (filter === 'failed') return !result.correct
    return true
  }

  const cardAt = (position) => {
    if (!cards[position]) cards[position] = reviewCard(report.results[position])
    return cards[position]
  }

  // Cards are built once and re-attached, so filtering neither rebuilds nor
  // re-animates the cards already on screen; only newly revealed ones fade in.
  const renderList = () => {
    const nextShown = {}
    let fresh = 0
    const nodes = []
    report.results.forEach((result, index) => {
      if (!matches(result)) return
      const card = cardAt(index)
      if (!shown[index]) {
        const delay = Math.min(fresh * 30, 300)
        fresh += 1
        card.style.animationDelay = `${delay}ms`
        card.classList.add('animate-fade-up')
        setTimeout(() => card.classList.remove('animate-fade-up'), delay + 550)
      }
      nextShown[index] = true
      nodes.push(card)
    })
    shown = nextShown
    clear(listHost)
    append(
      listHost,
      nodes.length
        ? nodes
        : [el('p', { class: 'rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500', text: 'No hay preguntas en esta categoría.' })],
    )
    listHost.classList.toggle('is-long', nodes.length >= 12)
  }

  const tabClass = (active) =>
    `rounded px-4 py-2 text-sm font-semibold transition ${
      active ? 'bg-brand-600 text-white shadow-card' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    }`

  const buildTab = (key, label, count) => {
    const active = key === filter
    const button = el('button', {
      type: 'button',
      'data-filter': key,
      'aria-pressed': String(active),
      class: tabClass(active),
      on: {
        click: () => {
          filter = key
          tabNodes.forEach((tab) => {
            const on = tab.key === filter
            tab.button.className = tabClass(on)
            tab.button.setAttribute('aria-pressed', String(on))
          })
          renderList()
        },
      },
      kids: [`${label} `, el('span', { class: 'text-xs opacity-70', text: String(count) })],
    })
    tabNodes.push({ key, button })
    return button
  }

  const topicIds = config.topics
  const topicSummary =
    topicIds.length === topics().length
      ? 'Todos los temas'
      : topicIds.length <= 4
        ? topicIds.map((id) => topicLabel(id)).join(', ')
        : `${topicIds.length} temas seleccionados`

  // Fail: studying the misses is the primary action. Pass: the record (PDF) is.
  const downloadLabel = el('span', { text: 'Descargar PDF' })
  const downloadButton = el(
    'button',
    {
      type: 'button',
      class: report.passed ? PRIMARY_CLASS : SECONDARY_CLASS,
      'data-action': 'download',
      on: {
        click: () => {
          if (downloadButton.disabled) return
          downloadButton.disabled = true
          downloadButton.setAttribute('aria-busy', 'true')
          downloadLabel.textContent = 'Generando PDF…'
          // The PDF generator is fetched on demand, so the button owns the
          // wait state and is restored whether the fetch succeeds or fails.
          onDownload(() => {
            downloadButton.disabled = false
            downloadButton.removeAttribute('aria-busy')
            downloadLabel.textContent = 'Descargar PDF'
          })
        },
      },
      kids: [icon('download', 'h-4 w-4'), downloadLabel],
    },
  )

  const retryButton = el(
    'button',
    {
      type: 'button',
      class: SECONDARY_CLASS,
      'data-action': 'retry',
      on: { click: onRetry },
      kids: [icon('refresh', 'h-4 w-4'), 'Repetir test'],
    },
  )

  const newButton = el(
    'button',
    {
      type: 'button',
      class: SECONDARY_CLASS,
      'data-action': 'new',
      on: { click: onNew },
      kids: [icon('grid', 'h-4 w-4'), 'Nuevo test'],
    },
  )

  let retryFailedButton = null
  if (failedCount) {
    retryFailedButton = el('button', {
      type: 'button',
      class: report.passed ? DANGER_CLASS : PRIMARY_CLASS,
      'data-action': 'retry-failed',
      on: { click: onRetryFailed },
      kids: [
        icon('refresh', 'h-4 w-4'),
        failedCount === 1 ? 'Repetir el fallo' : `Repetir los ${failedCount} fallos`,
      ],
    })
  }

  const hero = el(
    'section',
    {
      class: `relative overflow-hidden rounded-md border p-6 shadow-lift sm:p-8 animate-fade-up ${
        report.passed
          ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 dark:border-emerald-900 dark:from-emerald-950 dark:via-slate-900 dark:to-slate-950'
          : 'border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50/60 dark:border-rose-900 dark:from-rose-950 dark:via-slate-900 dark:to-slate-950'
      }`,
    },
    el(
      'div',
      // The three-column hero (ring · copy · actions) needs real width for the
      // display headline; below lg it stacks, which is also the better reading
      // order on tablets.
      { class: 'relative flex flex-col items-center gap-6 px-3 lg:flex-row lg:gap-8 lg:pr-0' },
      el(
        'div',
        { class: 'relative h-36 w-36 shrink-0' },
        el(
          'svg',
          { viewBox: '0 0 120 120', class: 'h-36 w-36 -rotate-90' },
          el('circle', {
            cx: '60',
            cy: '60',
            r: '54',
            fill: 'none',
            class: 'stroke-slate-200 dark:stroke-slate-700',
            'stroke-width': '10',
          }),
          ringStroke,
        ),
        el(
          'div',
          { class: 'absolute inset-0 flex flex-col items-center justify-center gap-1' },
          el('span', { class: 'font-display text-3xl font-bold text-ink', text: `${report.percentage}%` }),
          el('span', { class: 'text-[11px] font-medium uppercase tracking-wide text-slate-500', text: 'respuestas' }),
        ),
      ),
      el(
        'div',
        { class: 'min-w-0 flex-1 text-center lg:text-left' },
        el('span', {
          class: `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
            report.passed ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'
          }`,
          kids: [icon(report.passed ? 'check' : 'x', 'h-3.5 w-3.5'), report.passed ? 'Aprobado' : 'No aprobado'],
        }),
        el('h1', {
          class: 'mt-3 font-display text-3xl font-bold text-ink text-balance sm:text-4xl',
          text: report.passed ? '¡Enhorabuena, has aprobado!' : '¡Esta vez no ha sido posible!',
        }),
        el('p', { class: 'mt-2 text-sm leading-relaxed text-slate-600' }, [
          'Has acertado ',
          el('strong', {
            class: 'font-semibold text-ink',
            text: `${report.score} de ${report.totalAnswers} respuestas`,
          }),
          report.passed
            ? ` (${report.percentage}%), por encima del 75% exigido.`
            : ` (${report.percentage}%). Necesitabas ${report.required} respuestas correctas para aprobar (75%).`,
        ]),
        el(
          'div',
          { class: 'mt-4 flex flex-wrap justify-center gap-2 lg:justify-start' },
          [
            `${config.size} preguntas`,
            topicSummary,
            `mín. ${report.required} respuestas`,
            report.elapsedTime !== undefined
              ? `Tiempo: ${Math.floor(report.elapsedTime / 60)}m ${report.elapsedTime % 60}s`
              : null,
            new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
          ]
            .filter(Boolean)
            .map((text) =>
              el('span', {
                class: 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
                text,
              }),
            ),
        ),
      ),
      el(
        'div',
        { class: 'flex w-full flex-col gap-2.5 lg:w-auto lg:shrink-0' },
        (report.passed ? [downloadButton, retryFailedButton, retryButton, newButton] : [retryFailedButton, downloadButton, retryButton, newButton]).filter(Boolean),
      ),
    ),
  )

  const legendItem = (tone, label) =>
    el(
      'span',
      { class: 'inline-flex items-center gap-1.5' },
      el('span', { class: `h-2.5 w-2.5 rounded-full ${tone}` }),
      label,
    )

  // A legend is a reading aid, not a container: plain row, no box.
  const legend = el(
    'div',
    {
      class: 'mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-slate-600 dark:text-slate-400',
    },
    [
      legendItem('bg-emerald-500', 'Acertada'),
      legendItem('bg-amber-500', 'Correcta que no marcaste'),
      legendItem('bg-rose-500', 'Fallada'),
      legendItem('bg-slate-400', 'Sin responder'),
    ],
  )

  const review = el(
    'section',
    { class: 'mt-6' },
    el(
      'div',
      { class: 'flex flex-wrap items-center justify-between gap-3' },
      el('h2', { class: 'font-display text-lg font-semibold text-ink', text: 'Revisión del test' }),
      el(
        'div',
        { class: 'flex flex-wrap gap-1 rounded border border-slate-200 bg-white p-1 dark:border-slate-800' },
        buildTab('all', 'Todas', report.total),
        buildTab('correct', 'Aciertos', report.correct),
        buildTab('failed', 'Fallos', report.total - report.correct),
      ),
    ),
    legend,
    el('div', { class: 'mt-4' }, listHost),
  )

  mountChildren(node, [hero, review])
  renderList()

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ringStroke.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * (1 - report.percentage / 100)))
    })
  })
}
