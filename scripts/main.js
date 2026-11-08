import { load, pool } from './data.js'
import { createQuiz } from './quiz.js'
import { el, icon, showScreen, toast } from './render.js'
import { mount as mountSetup } from './screens/setup.js'
import * as Stats from './stats.js'

// Each screen is its own chunk: the first paint only pays for setup, and the
// quiz, results, statistics and PDF pipeline load on the first click that
// needs them. A failed load is retried by the next click.
const CHUNKS = {
  quiz: () => import('./screens/quiz.js'),
  results: () => import('./screens/results.js'),
  stats: async () => {
    await load()
    return import('./screens/stats.js')
  },
  pdf: () => import('./pdf.js'),
  pdfViewer: () => import('./pdf-modal.js'),
}

const chunkLoads = {}

const loadChunk = (name) => {
  if (!chunkLoads[name]) {
    chunkLoads[name] = CHUNKS[name]().catch((error) => {
      delete chunkLoads[name]
      throw error
    })
  }
  return chunkLoads[name]
}

const state = { config: null, quiz: null, report: null, startTime: null, elapsedTime: 0 }
let starting = false

const screenNode = (id) => document.getElementById(id)

// The progress entry point lives in the header: it is global to the three
// screens and only exists once this browser holds at least one attempt.
const renderHeaderStatsButton = () => {
  const host = document.getElementById('header-actions')
  if (!host) return

  const existing = document.getElementById('stats-toggle')
  if (!Stats.all().length) {
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing)
    return
  }
  if (existing) return

  const button = el(
    'button',
    {
      type: 'button',
      id: 'stats-toggle',
      'data-action': 'stats',
      'aria-label': 'Mis estadísticas',
      class:
        'inline-flex h-11 items-center justify-center gap-2 rounded border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-white',
      on: {
        click: () => {
          loadChunk('stats')
            .then(({ open }) => {
              open({
                onCleared: () => {
                  if (button.parentNode) button.parentNode.removeChild(button)
                },
              })
            })
            .catch(() => {
              toast('No se pudieron cargar las estadísticas. Vuelve a intentarlo.')
            })
        },
      },
      kids: [icon('chart', 'h-5 w-5 shrink-0'), el('span', { class: 'hidden sm:inline', text: 'Estadísticas' })],
    },
  )

  host.appendChild(button)
}

const showSetup = () => {
  renderHeaderStatsButton()
  showScreen('screen-setup')
  mountSetup(screenNode('screen-setup'), {
    onStart: (config) => {
      state.config = config
      startQuiz(config)
    },
  })
}

const startQuiz = (config) => {
  // The dataset is a separate chunk: fetch it before the attempt is built, so
  // the first paint never pays for the catalogue.
  load()
    .then(() => {
      launchQuiz(pool(config.topics), config.size, Stats.MODES.full)
    })
    .catch(() => {
      toast('No se pudo cargar el catálogo de preguntas. Revisa tu conexión y vuelve a intentarlo.')
    })
}

// One mount for both paths (a fresh test and the retry of the misses) so the
// attempt is recorded in a single place.
const launchQuiz = (questions, size, mode) => {
  if (starting) return
  starting = true

  loadChunk('quiz')
    .then(({ mount: mountQuiz }) => {
      starting = false
      state.quiz = createQuiz({ pool: questions, size })
      state.startTime = Date.now()
      state.elapsedTime = 0
      showScreen('screen-quiz')
      mountQuiz(screenNode('screen-quiz'), {
        quiz: state.quiz,
        onFinish: (report) => {
          state.elapsedTime = Math.floor((Date.now() - state.startTime) / 1000)
          report.elapsedTime = state.elapsedTime
          state.report = report
          recordAttempt(report, mode)
          showResults()
        },
        onExit: showSetup,
      })
    })
    .catch(() => {
      starting = false
      toast('No se pudo cargar el test. Revisa tu conexión y vuelve a intentarlo.')
    })
}

const recordAttempt = (report, mode) => {
  Stats.record(Stats.toAttempt(report, mode))
}

const showResults = () => {
  renderHeaderStatsButton()
  loadChunk('results')
    .then(({ mount: mountResults }) => {
      showScreen('screen-results')
      mountResults(screenNode('screen-results'), {
        report: state.report,
        config: state.config,
        onDownload: (done) => {
          const finish = done || (() => {})
          loadChunk('pdf')
            .then(({ generate }) => generate(state.report, state.config))
            .then((name) => {
              if (name) toast(`PDF generado: ${name}`)
              finish()
            })
            .catch(() => {
              toast('No se pudo generar el PDF. Vuelve a intentarlo.')
              finish()
            })
        },
        onRetry: () => {
          startQuiz(state.config)
        },
        onRetryFailed: () => {
          const failed = state.report.results
            .filter((result) => !result.correct)
            .map((result) => result.question)
          const size = Math.min(state.config.size, failed.length)
          state.config = { ...state.config, size }
          launchQuiz(failed, size, Stats.MODES.retry)
        },
        onNew: showSetup,
      })
    })
    .catch(() => {
      toast('No se pudieron cargar los resultados. Revisa tu conexión y vuelve a intentarlo.')
    })
}

// Every PDF link in the app (rule chips, the footer sources) opens in the
// in-app viewer instead of a new tab. Modified clicks keep the browser default.
const interceptPdfLinks = () => {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const link = event.target?.closest?.('a[href]')
    if (!link) return
    if (link.closest('[role="dialog"]')) return

    const href = link.getAttribute('href') || ''
    if (!/\.pdf(?:[?#]|$)/i.test(href)) return

    event.preventDefault()
    loadChunk('pdfViewer')
      .then(({ open }) => {
        open({ url: href, title: link.textContent.trim() })
      })
      .catch(() => {
        globalThis.location.href = href
      })
  })
}

const boot = () => {
  showSetup()
  interceptPdfLinks()

  const toggle = document.getElementById('theme-toggle')
  if (!toggle) return

  const syncThemeLabel = () => {
    const isDark = document.documentElement.classList.contains('dark')
    toggle.setAttribute('aria-pressed', String(isDark))
    toggle.setAttribute('aria-label', isDark ? 'Activar tema claro' : 'Activar tema oscuro')
  }

  syncThemeLabel()
  toggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark')
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light')
    } catch {
      // Private mode or a full quota: the choice still applies to this page.
    }
    syncThemeLabel()
  })
}

document.addEventListener('DOMContentLoaded', boot)
