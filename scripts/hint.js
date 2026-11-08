import { chips, rulesUrl } from './data.js'
import { el, icon } from './render.js'

const chipNode = (chip) => {
  const className =
    'inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100/70 px-2.5 py-1 text-xs font-medium text-amber-900 transition hover:border-amber-300 hover:bg-amber-200/80'

  if (!chip.page) return el('span', { class: className, text: chip.label })

  return el('a', {
    class: className,
    href: rulesUrl(chip.page),
    target: '_blank',
    rel: 'noopener',
    title: `Abrir las Reglas de Juego en la página ${chip.page}`,
    text: chip.label,
  })
}

export const create = (question, options) => {
  const subtle = !!(options && options.subtle)
  const questionChips = chips(question)
  const firstLink = questionChips.find((chip) => chip.page)

  const label = el('span', { text: 'Ver pista' })
  let open = false

  const rulesLink = firstLink
    ? el('a', {
      class:
        'inline-flex shrink-0 items-center gap-1.5 rounded border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100',
      href: rulesUrl(firstLink.page),
      target: '_blank',
      rel: 'noopener',
      kids: [icon('doc', 'h-4 w-4'), 'Ver en las Reglas de Juego'],
    })
    : null

  const panel = el(
    'div',
    { class: 'hint-panel' },
    el(
      'div',
      null,
      el(
        'div',
        {
          class:
            'mt-4 hint-box rounded-md border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-amber-50/60 p-4 shadow-card animate-fade-in',
        },
        el(
          'div',
          { class: 'flex flex-wrap items-start justify-between gap-3' },
          el(
            'div',
            { class: 'min-w-0' },
            el('p', {
              class: 'text-[11px] font-semibold uppercase tracking-wider text-amber-800',
              text: 'Pista · directrices de la respuesta',
            }),
            el('div', { class: 'mt-2 flex flex-wrap gap-2', kids: questionChips.map((chip) => chipNode(chip)) }),
          ),
          rulesLink,
        ),
        el('p', {
          class: 'mt-2 max-w-lg text-xs leading-relaxed text-slate-500',
          text: 'El catálogo de respuestas cita estas directrices como fundamento de la respuesta correcta.',
        }),
      ),
    ),
  )

  const button = el(
    'button',
    {
      type: 'button',
      'aria-expanded': 'false',
      'data-action': 'hint',
      class: subtle
        ? 'hint-link -mr-1 inline-flex items-center gap-1.5 rounded px-2 py-2 text-xs font-semibold text-amber-700 transition hover:text-amber-800 hover:underline hover:underline-offset-4 dark:text-amber-300 dark:hover:text-amber-200 sm:py-1'
        : 'inline-flex items-center gap-2 rounded border border-accent-300/70 bg-accent-300/15 px-3.5 py-2 text-sm font-semibold text-amber-700 transition hover:bg-accent-300/30 dark:text-amber-300',
      on: {
        click: () => {
          open = !open
          panel.classList.toggle('open', open)
          button.setAttribute('aria-expanded', String(open))
          label.textContent = open ? 'Ocultar pista' : 'Ver pista'
          if (open) {
            setTimeout(() => {
              panel.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 120)
          }
        },
      },
      kids: [icon('bulb', subtle ? 'h-3.5 w-3.5' : 'h-4 w-4'), label],
    },
  )

  return { button, panel }
}
