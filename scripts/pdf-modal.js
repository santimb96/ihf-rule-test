import { closeButton, open as openDialog } from './dialog.js'
import { el, icon, reducedMotion } from './render.js'

export const decodeFileName = (url) => {
  const clean = (url || '').split('#')[0].split('?')[0].split('/').pop() || ''
  try {
    return decodeURIComponent(clean)
  } catch {
    return clean
  }
}

export const pageOf = (url) => {
  const hash = (url || '').split('#')[1] || ''
  const match = hash.match(/page=(\d+)/i)
  return match ? Number(match[1]) : null
}

export const open = (options) => {
  const { url, title } = options || {}
  if (!url) return
  if (document.getElementById('pdf-dialog')) return

  const page = pageOf(url)
  const file = decodeFileName(url)
  const isRules = /reglas de juego|rules of game/i.test(file)
  const heading = (page || isRules) ? 'Reglas de Juego' : title || file.replace(/\.pdf$/i, '')
  const subtitle = file + (page ? ` · página ${page}` : '')

  let handle = null
  const closeControl = closeButton(() => {
    if (handle) handle.close()
  })

  const openInTab = el('a', {
    href: url,
    target: '_blank',
    rel: 'noopener',
    'aria-label': 'Abrir el PDF en una pestaña nueva',
    class:
      'inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white',
    kids: [icon('doc', 'h-4 w-4 shrink-0'), el('span', { class: 'hidden sm:inline', text: 'Abrir en pestaña' })],
  })

  handle = openDialog({
    id: 'pdf-dialog',
    labelledBy: 'pdf-title',
    initialFocus: closeControl,
    className:
      'flex h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-md border border-slate-200/80 bg-white shadow-lift dark:border-slate-700 dark:bg-slate-900 sm:h-[88vh] sm:rounded-md' +
      (reducedMotion() ? '' : ' animate-pop-in'),
    children: [
      el(
        'div',
        {
          class:
            'flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700 sm:px-5',
        },
        el(
          'div',
          { class: 'min-w-0' },
          el('p', {
            class: 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400',
            text: 'Documento',
          }),
          el('h2', {
            id: 'pdf-title',
            class: 'mt-0.5 font-display text-base font-semibold text-ink dark:text-slate-100',
            text: heading,
          }),
          el('p', {
            class: 'mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400',
            text: subtitle,
          }),
        ),
        el('div', { class: 'flex shrink-0 items-center gap-2' }, [openInTab, closeControl]),
      ),
      el('iframe', {
        src: url,
        title: heading + (page ? `, página ${page}` : ''),
        loading: 'lazy',
        class: 'min-h-0 w-full flex-1 border-0 bg-slate-100 dark:bg-slate-800',
      }),
    ],
  })
}
