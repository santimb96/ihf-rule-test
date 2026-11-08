import { el, icon, append } from '../render.js'
import { topics, poolSize, getMeta } from '../data.js'
import { SUPPORTED_LENGTHS } from '../scoring.js'

// Setup screen: topic filter, test length picker and start CTA. The pool size
// drives which lengths are available and the pass requirement.

// Kept across mounts: the hero ships in index.html (see mount()).
let heroNode = null

export const mount = (node, options) => {
  const { onStart } = options
  const allTopics = topics()
  const selected = new Set(allTopics.map((topic) => topic.id))
  let size = 10

  const currentPool = () => poolSize(Array.from(selected))

  const chipNodes = []
  const sizeNodes = []
  let allButton
  let poolLabel
  let poolNote
  let startButton
  let topicSummary
  let topicGrid
  let topicToggle
  // On phones the 19-topic catalogue pushes the CTA three screens down: the
  // list starts folded there and the sticky summary carries the action.
  const isCompact = window.matchMedia?.('(max-width: 1023px)').matches ?? false
  let topicsExpanded = !isCompact

  const sync = () => {
    const available = currentPool()

    chipNodes.forEach((entry) => {
      const on = selected.has(entry.id)
      if (entry.on === on) return
      entry.on = on
      entry.button.setAttribute('aria-pressed', String(on))
      entry.button.className = chipClass(on)
      entry.check.className = chipCheck(on)
      entry.icon.style.opacity = on ? '1' : '0'
      entry.badge.className = chipBadge(on)
    })

    if (allButton) {
      const allOn = selected.size === allTopics.length
      const allLabel = allOn ? 'Quitar todos' : 'Seleccionar todos'
      if (allButton.textContent !== allLabel) allButton.textContent = allLabel
    }

    if (topicSummary) {
      const summaryText =
        selected.size === allTopics.length
          ? `Todos los temas · ${available} preguntas`
          : `${selected.size} de ${allTopics.length} temas · ${available} preguntas`
      if (topicSummary.textContent !== summaryText) topicSummary.textContent = summaryText
    }

    const fallback = SUPPORTED_LENGTHS.filter((n) => n <= available)
    if (available >= 5 && !fallback.includes(size)) size = fallback[fallback.length - 1]

    sizeNodes.forEach((entry) => {
      const enabled = available >= entry.size && fallback.includes(entry.size)
      const active = entry.size === size && enabled
      if (entry.enabled !== enabled) {
        entry.enabled = enabled
        entry.button.disabled = !enabled
        entry.button.classList.toggle('opacity-40', !enabled)
        entry.button.setAttribute('aria-pressed', String(active))
      }
      if (entry.active !== active) {
        entry.active = active
        entry.button.classList.toggle('size-active', active)
        entry.button.setAttribute('aria-pressed', String(active))
      }
      const hint = !enabled ? 'no hay suficientes preguntas' : ''
      if (entry.hint.textContent !== hint) entry.hint.textContent = hint
      // The 5-question option still runs on a smaller pool.
      if (available < entry.size && entry.size === 5 && available >= 1) {
        entry.hint.textContent = `solo ${available} disponibles`
      }
    })

    const label = `${available} ${available === 1 ? 'pregunta disponible' : 'preguntas disponibles'}`
    if (poolLabel.textContent !== label) poolLabel.textContent = label

    const shortPool = available < 5
    const note = shortPool
      ? 'Necesitas al menos 5 preguntas: selecciona más temas.'
      : `Aprobado con ≥75% de las respuestas · ${size} preguntas`
    const noteClass = shortPool ? 'text-xs font-medium text-rose-700' : 'text-xs text-slate-500'
    if (poolNote.textContent !== note) poolNote.textContent = note
    if (poolNote.className !== noteClass) poolNote.className = noteClass
    if (startButton.disabled !== shortPool) startButton.disabled = shortPool
  }

  const chipClass = (on) =>
    `option flex w-full items-center gap-3 rounded border px-3.5 py-3 text-left ${on ? 'border-brand-500 bg-brand-50/80 shadow-card ring-1 ring-brand-500 dark:border-brand-500 dark:bg-brand-900/40' : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-card dark:border-slate-700 dark:bg-slate-800/60'}`

  // Rule codes read as codes, not as counters, so they ship in the data face.
  const chipBadge = (on) =>
    `grid h-8 min-w-8 shrink-0 place-items-center rounded border px-1.5 font-mono text-xs font-semibold tabular-nums transition ${on ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/60 dark:text-brand-200' : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'}`

  const chipCheck = (on) =>
    `grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition ${on ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-transparent dark:border-slate-600'}`

  const buildChip = (topic) => {
    const checkIcon = icon('check', 'h-3.5 w-3.5 text-white')
    checkIcon.style.opacity = '0'
    const check = el('span', { class: chipCheck(false), kids: [checkIcon] })
    const badge = el('span', { class: chipBadge(false), text: topic.id === 'SAR' ? 'ZC' : topic.id })
    const count = poolSize([topic.id])
    const button = el(
      'button',
      {
        type: 'button',
        'aria-pressed': 'false',
        'data-topic': topic.id,
        class: chipClass(false),
        on: {
          click: () => {
            if (selected.has(topic.id)) selected.delete(topic.id)
            else selected.add(topic.id)
            sync()
          },
        },
      },
      badge,
      el(
        'span',
        { class: 'min-w-0 flex-1' },
        el('span', { class: 'block text-sm font-semibold leading-snug text-ink', text: topic.label }),
        el('span', { class: 'block text-xs text-slate-600', text: `${count} ${count === 1 ? 'pregunta' : 'preguntas'}` }),
      ),
      check,
    )
    chipNodes.push({ id: topic.id, button, check, icon: checkIcon, badge })
    return button
  }

  // Deliberately secondary to the question count: the minutes are an approximation.
  const estimateMinutes = (n) => {
    if (n <= 5) return 10
    if (n <= 10) return 15
    if (n <= 20) return 25
    return 35
  }

  const buildSizeButton = (n) => {
    const hint = el('span', { class: 'block text-[11px] text-slate-500' })
    const button = el(
      'button',
      {
        type: 'button',
        'data-size': String(n),
        'aria-pressed': 'false',
        class: 'option group relative rounded border border-slate-200 bg-white px-4 py-4 text-center transition',
        on: {
          click: () => {
            if (button.disabled) return
            size = n
            sync()
          },
        },
      },
      el('span', { class: 'block font-display text-2xl font-bold text-ink', text: String(n) }),
      el('span', { class: 'mt-0.5 block text-xs font-normal text-slate-500', text: 'preguntas' }),
      el('span', {
        class: 'mt-1 block text-xs font-medium text-slate-500',
        text: `${estimateMinutes(n)} minutos aprox.`,
      }),
      hint,
    )
    sizeNodes.push({ size: n, button, hint })
    return button
  }

  // The hero is static markup in index.html: it is the first paint and holds
  // the LCP screenshot, so it must not wait for this script. Only its
  // dataset-derived figure is synced here.
  if (!heroNode) {
    heroNode = document.getElementById('setup-hero')
    const countNode = heroNode?.querySelector('[data-question-count]')
    if (countNode && countNode.textContent !== String(getMeta().questionCount)) {
      countNode.textContent = String(getMeta().questionCount)
    }
  }
  if (!heroNode) {
    heroNode = el('h1', {
      class: 'rounded-md bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 p-6 font-display text-3xl font-bold text-white shadow-lift sm:p-8',
      text: 'Prepara tu test de reglas de juego',
    })
  }
  const hero = heroNode

  const topicsCard = el(
    'section',
    { class: 'mt-6 rounded-md border border-slate-200/80 bg-white p-5 shadow-card sm:p-6' },
    el(
      'div',
      { class: 'flex flex-wrap items-start justify-between gap-3' },
      el(
        'div',
        { class: 'flex items-start gap-3' },
        el('span', { class: 'mr-2 font-display text-4xl font-bold text-brand-600 dark:text-brand-400', text: '1' }),
        el(
          'div',
          null,
          el('h2', { class: 'font-display text-lg font-semibold text-ink', text: 'Temas del test' }),
          (topicSummary = el('p', { class: 'text-xs text-slate-500' })),
        ),
      ),
      el(
        'div',
        { class: 'flex flex-wrap items-center gap-2' },
        (allButton = el('button', {
          type: 'button',
          'data-action': 'toggle-all',
          class: 'rounded border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 active:translate-y-px dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:bg-brand-900/40 dark:hover:text-brand-200',
          on: {
            click: () => {
              if (selected.size === allTopics.length) selected.clear()
              else allTopics.forEach((topic) => selected.add(topic.id))
              sync()
            },
          },
          text: 'Quitar todos',
        })),
        (topicToggle = el('button', {
          type: 'button',
          'data-action': 'toggle-topics',
          'aria-expanded': 'false',
          'aria-controls': 'topic-grid',
          class: 'rounded border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 active:translate-y-px dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:bg-brand-900/40 dark:hover:text-brand-200',
          on: {
            click: () => {
              topicsExpanded = !topicsExpanded
              syncTopics()
            },
          },
          text: 'Ver temas',
        })),
      ),
    ),
    (topicGrid = el('div', {
      id: 'topic-grid',
      class: 'mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3',
      kids: allTopics.map(buildChip),
    })),
  )

  const syncTopics = () => {
    topicGrid.classList.toggle('hidden', !topicsExpanded)
    topicToggle.setAttribute('aria-expanded', String(topicsExpanded))
    topicToggle.textContent = topicsExpanded ? 'Ocultar temas' : 'Ver temas'
  }

  const sizesCard = el(
    'section',
    { class: 'mt-6 rounded-md border border-slate-200/80 bg-white p-5 shadow-card sm:p-6' },
    el(
      'div',
      { class: 'flex items-start gap-3' },
      el('span', { class: 'mr-2 font-display text-4xl font-bold text-brand-600 dark:text-brand-400', text: '2' }),
      el(
        'div',
        null,
        el('h2', { class: 'font-display text-lg font-semibold text-ink', text: 'Preguntas por cuestionario' }),
        el(
          'p',
          { class: 'text-xs text-slate-500', text: 'Se aprueba con un 75% o más de respuestas correctas. ' },
          el('strong', { class: 'font-semibold text-ink', text: 'Una o varias respuestas correctas por pregunta.' }),
        ),
      ),
    ),
    el('div', {
      class: 'mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4',
      kids: SUPPORTED_LENGTHS.map(buildSizeButton),
    }),
  )

  poolLabel = el('p', { class: 'text-sm font-semibold text-ink' })
  poolNote = el('p', { class: 'text-xs text-slate-500' })

  startButton = el('button', {
    type: 'button',
    'data-action': 'start',
    class:
      'group inline-flex w-full items-center justify-center gap-2 rounded bg-gradient-to-r from-brand-600 to-brand-500 px-7 py-3.5 font-semibold text-white shadow-lift transition hover:-translate-y-0.5 hover:from-brand-500 hover:to-brand-400 active:translate-y-0 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto',
    on: {
      click: () => {
        if (startButton.disabled) return
        onStart({ topics: Array.from(selected), size })
      },
    },
    kids: ['Comenzar test', icon('right', 'h-5 w-5 transition-transform group-hover:translate-x-0.5')],
  })

  // Sticky on phones: `bottom` keeps the CTA in view while the catalogue
  // scrolls, then it settles into the page flow at its natural position.
  const summary = el(
    'div',
    { class: 'sticky bottom-3 z-30 mt-6 flex flex-col gap-4 rounded-md border border-slate-200/80 bg-white/95 p-5 shadow-lift backdrop-blur sm:static sm:flex-row sm:items-center sm:justify-between sm:bg-white dark:border-slate-700 dark:bg-slate-900/95 sm:dark:bg-slate-900' },
    el('div', null, poolLabel, poolNote),
    startButton,
  )

  // Supplementary context, deliberately not another floating card: the page
  // already has two tool panels, so this closes with a rule instead.
  const gitHubCard = el(
    'section',
    { class: 'mt-8 border-t border-slate-200 pt-6 dark:border-slate-800' },
    el(
      'div',
      { class: 'flex items-center gap-3' },
      icon('github', 'h-6 w-6 shrink-0 text-slate-500'),
      el('h2', { class: 'font-display text-lg font-semibold text-ink', text: 'Sobre este proyecto' }),
    ),
    el('p', {
      class: 'mt-3 max-w-lg text-sm leading-relaxed text-slate-500',
      text: 'Esta web es una herramienta de estudio. No es oficial ni está vinculada con la IHF. Los datos expuestos son de dominio público. ¡Puedes consultar el proyecto o abrir una issue para mejorarlo!',
    }),
    el(
      'div',
      { class: 'mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold' },
      el('a', {
        href: 'https://github.com/santimb96/ihf-rule-test',
        target: '_blank',
        rel: 'noopener',
        class: 'inline-flex items-center gap-1.5 text-brand-700 underline-offset-4 transition hover:underline dark:text-brand-300',
        kids: [icon('github', 'h-4 w-4'), 'Ver el proyecto en GitHub'],
      }),
      el('a', {
        href: 'https://github.com/santimb96/ihf-rule-test/issues',
        target: '_blank',
        rel: 'noopener',
        class: 'inline-flex items-center gap-1.5 text-slate-600 underline-offset-4 transition hover:text-brand-700 hover:underline dark:text-slate-300 dark:hover:text-brand-300',
        kids: [icon('issue', 'h-4 w-4 shrink-0'), 'Abrir una issue'],
      }),
    ),
  )

  // The hero stays attached: detaching it (even to append it back in the same
  // batch) makes Chrome drop its paint as an LCP candidate, which would defeat
  // having it in the initial HTML. Only the cards are rebuilt.
  if (hero.parentNode !== node) node.insertBefore(hero, node.firstChild)
  Array.from(node.childNodes).forEach((child) => {
    if (child !== hero) node.removeChild(child)
  })
  append(node, [topicsCard, sizesCard, summary, gitHubCard])
  sync()
  syncTopics()
}
