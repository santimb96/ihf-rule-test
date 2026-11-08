const ICONS = {}
const iconPromises = {}

const ICON_NAMES = [
  'check', 'alert', 'dash', 'x', 'bulb', 'left', 'right',
  'flag', 'download', 'refresh', 'grid', 'close', 'doc', 'clock', 'chart', 'github', 'issue',
]

const SVG_NS = 'http://www.w3.org/2000/svg'
const SVG_TAGS = new Set(['svg', 'circle', 'path', 'rect', 'line', 'g', 'ellipse', 'polyline', 'polygon'])

// Fetched on first use: asking for all 17 at parse time put 17 high-priority
// requests in front of the LCP resources. A screen only draws a handful.
const loadIcon = (name) => {
  if (!ICON_NAMES.includes(name)) return Promise.resolve('')
  if (!iconPromises[name]) {
    iconPromises[name] = fetch(`./assets/icons/${name}.svg`)
      .then((response) => response.text())
      .then((svg) => {
        ICONS[name] = svg
        return svg
      })
      .catch(() => {
        ICONS[name] = ''
        return ''
      })
  }
  return iconPromises[name]
}

export const append = (node, child) => {
  if (child == null || child === false) return
  if (Array.isArray(child)) {
    child.forEach((entry) => append(node, entry))
    return
  }
  if (child instanceof Node) {
    node.appendChild(child)
    return
  }
  node.appendChild(document.createTextNode(String(child)))
}

export const el = (tag, props, ...children) => {
  const options = props || {}
  const node = SVG_TAGS.has(tag) ? document.createElementNS(SVG_NS, tag) : document.createElement(tag)

  Object.entries(options).forEach(([key, value]) => {
    if (value == null || value === false) return
    if (key === 'class') node.setAttribute('class', value)
    else if (key === 'text') node.textContent = value
    else if (key === 'html') node.innerHTML = value
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value)
    else if (key === 'dataset') Object.assign(node.dataset, value)
    else if (key === 'on') {
      Object.entries(value).forEach(([event, handler]) => node.addEventListener(event, handler))
    } else if (key !== 'kids') node.setAttribute(key, value === true ? '' : value)
  })

  append(node, options.kids)
  children.forEach((child) => append(node, child))
  return node
}

export const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild)
}

export const mount = (node, children) => {
  clear(node)
  append(node, children)
  return node
}

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export const showScreen = (id) => {
  const target = document.getElementById(id)
  const wasHidden = target.classList.contains('hidden')

  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.add('hidden')
  })

  target.classList.remove('hidden')
  // Only swapped-in screens animate: the setup screen ships visible, and an
  // entry animation there paints the hero at opacity 0 on first load.
  if (wasHidden) target.classList.add('screen-enter')
  target.style.animation = 'none'
  void target.offsetHeight
  target.style.animation = ''
  window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })
}

let toastTimer = null

export const toast = (message) => {
  const node = document.getElementById('toast')
  if (node.textContent !== message) node.textContent = message
  node.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    node.classList.remove('show')
  }, 2600)
}

export const icon = (name, className) => {
  const span = el('span', { class: className || 'h-5 w-5' })
  if (ICONS[name]) {
    span.innerHTML = ICONS[name]
  } else {
    loadIcon(name).then((svg) => {
      span.innerHTML = svg
    })
  }
  return span
}
