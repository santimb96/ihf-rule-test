import { el, icon, reducedMotion } from './render.js'

// The labelled close control both dialogs use: an icon alone reads as
// "dismiss?"; the word removes the guess.
export const closeButton = (onClick, label) =>
  el(
    'button',
    {
      type: 'button',
      class:
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white',
      on: { click: onClick },
      kids: [icon('close', 'h-4 w-4 shrink-0'), el('span', { text: label || 'Cerrar' })],
    },
  )

export const open = ({ id, labelledBy, className = '', overlayClass, children, onClose, initialFocus } = {}) => {
  if (id && document.getElementById(id)) return null

  const previousFocus = document.activeElement
  const previousOverflow = document.body.style.overflow
  const app = document.getElementById('app')
  const appAriaHidden = app ? app.getAttribute('aria-hidden') : null
  let closed = false

  const dialog = el(
    'div',
    {
      id,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': labelledBy,
      class: className,
    },
    children,
  )

  const overlay = el(
    'div',
    {
      class:
        overlayClass ||
        `fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-6${reducedMotion() ? '' : ' animate-fade-in'}`,
      on: {
        click: (event) => {
          if (event.target === overlay) close()
        },
      },
    },
    dialog,
  )

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return

    const focusables = dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    if (!focusables.length) return

    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const close = () => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = previousOverflow
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
    if (app) {
      if (appAriaHidden === null) app.removeAttribute('aria-hidden')
      else app.setAttribute('aria-hidden', appAriaHidden)
    }
    if (typeof onClose === 'function') onClose()
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus()
  }

  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown)
  document.body.appendChild(overlay)

  const target = initialFocus || dialog.querySelector('a[href], button:not([disabled])')
  if (target && typeof target.focus === 'function') target.focus()
  // The dialog lives outside #app, so hiding the page tree from assistive
  // technology keeps the modal as the only reachable content.
  if (app) app.setAttribute('aria-hidden', 'true')

  return { dialog, overlay, close }
}
