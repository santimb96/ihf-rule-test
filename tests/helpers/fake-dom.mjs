// Minimal fake DOM: enough to mount the real screens in node and assert what
// they render, without a browser or a heavyweight dependency.
// Not a *.test.mjs file, so `node --test tests/*.test.mjs` ignores it.

class ClassList {
  constructor (node) {
    this.node = node
    this.set = new Set()
  }

  add (...names) {
    names.forEach((name) => name && this.set.add(name))
  }

  remove (...names) {
    names.forEach((name) => this.set.delete(name))
  }

  contains (name) {
    return this.set.has(name)
  }

  toggle (name, force) {
    const on = force === undefined ? !this.set.has(name) : !!force
    if (on) this.set.add(name)
    else this.set.delete(name)
    return on
  }

  get value () {
    return [...this.set].join(' ')
  }
}

class FakeNode {
  constructor (tag) {
    this.tagName = String(tag || '').toUpperCase()
    this.children = []
    this.parentNode = null
    this.attributes = {}
    this.classList = new ClassList(this)
    this.style = {}
    this.dataset = {}
    this.listeners = {}
    this.offsetParent = this
    this._text = ''
    this.tabIndex = 0
  }

  get id () {
    return this.getAttribute('id') || ''
  }

  get className () {
    return this.classList.value
  }

  set className (value) {
    this.classList = new ClassList(this)
    String(value || '')
      .split(/\s+/)
      .filter(Boolean)
      .forEach((name) => this.classList.add(name))
  }

  setAttribute (name, value) {
    if (name === 'class') {
      this.className = value
      return
    }
    this.attributes[name] = String(value)
  }

  getAttribute (name) {
    if (name === 'class') return this.classList.value
    return name in this.attributes ? this.attributes[name] : null
  }

  removeAttribute (name) {
    delete this.attributes[name]
  }

  hasAttribute (name) {
    return name in this.attributes
  }

  get firstChild () {
    return this.children[0] || null
  }

  get childNodes () {
    return this.children
  }

  appendChild (child) {
    child.parentNode = this
    this.children.push(child)
    return child
  }

  append (...nodes) {
    nodes.forEach((node) => {
      if (node == null) return
      this.appendChild(typeof node === 'string' ? document.createTextNode(node) : node)
    })
  }

  insertBefore (child, reference) {
    child.parentNode = this
    const at = reference ? this.children.indexOf(reference) : -1
    if (at < 0) this.children.push(child)
    else this.children.splice(at, 0, child)
    return child
  }

  removeChild (child) {
    const at = this.children.indexOf(child)
    if (at >= 0) this.children.splice(at, 1)
    child.parentNode = null
    return child
  }

  remove () {
    if (this.parentNode) this.parentNode.removeChild(this)
  }

  get textContent () {
    if (this.tagName === '#TEXT') return this._text
    return this.children.map((child) => child.textContent).join('')
  }

  set textContent (value) {
    this.children = []
    this._text = String(value)
    if (this.tagName !== '#TEXT') {
      const text = new FakeNode('#text')
      text._text = String(value)
      text.parentNode = this
      this.children.push(text)
    }
  }

  get data () {
    return this._text
  }

  set data (value) {
    this._text = String(value)
  }

  set innerHTML (value) {
    this._text = String(value)
    this.children = []
  }

  addEventListener (type, handler) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type].push(handler)
  }

  removeEventListener (type, handler) {
    this.listeners[type] = (this.listeners[type] || []).filter((entry) => entry !== handler)
  }

  dispatch (type, event) {
    const detail = { target: this, currentTarget: this, preventDefault () {}, ...event }
    ;(this.listeners[type] || []).forEach((handler) => handler(detail))
  }

  click () {
    this.dispatch('click')
  }

  focus () {}

  getBoundingClientRect () {
    return { top: 0, left: 0, width: 0, height: 0 }
  }

  * walk () {
    for (const child of this.children) {
      yield child
      yield * child.walk()
    }
  }

  querySelector (selector) {
    return this.querySelectorAll(selector)[0] || null
  }

  querySelectorAll (selector) {
    const groups = parseSelector(selector)
    const found = []
    for (const node of this.walk()) {
      if (node.tagName === '#TEXT') continue
      if (groups.some((group) => matches(node, group))) found.push(node)
    }
    return found
  }
}

const parseSelector = (selector) =>
  String(selector)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((raw) => {
      const nots = []
      let text = raw.replace(/:not\(([^)]*)\)/g, (_, inner) => {
        nots.push(parseSelector(inner)[0])
        return ''
      })
      const attrs = []
      text = text.replace(/\[([^\]=]+)(?:="([^"]*)")?\]/g, (_, name, value) => {
        attrs.push({ name, value })
        return ''
      })
      const id = (text.match(/#([\w-]+)/) || [])[1] || null
      const classes = [...text.matchAll(/\.([\w-]+)/g)].map((match) => match[1])
      const tag = text.replace(/#[\w-]+/g, '').replace(/\.[\w-]+/g, '').trim()
      return { tag: tag.toUpperCase(), id, classes, attrs, nots }
    })

const matches = (node, group) => {
  if (group.tag && node.tagName !== group.tag) return false
  if (group.id && node.getAttribute('id') !== group.id) return false
  if (group.classes.some((name) => !node.classList.contains(name))) return false
  if (group.attrs.some((attr) => (attr.value === undefined ? !node.hasAttribute(attr.name) : node.getAttribute(attr.name) !== attr.value))) return false
  if (group.nots.some((not) => not && matches(node, not))) return false
  return true
}

const createStorage = () => {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  }
}

export const installFakeDom = () => {
  const localStorage = createStorage()
  const document = {
    createElement: (tag) => new FakeNode(tag),
    createElementNS: (_ns, tag) => new FakeNode(tag),
    createTextNode: (text) => {
      const node = new FakeNode('#text')
      node._text = String(text)
      return node
    },
    getElementById (id) {
      // Only attached nodes answer, so a closed dialog stops existing.
      if (document.body.getAttribute('id') === id) return document.body
      for (const node of document.body.walk()) {
        if (node.getAttribute && node.getAttribute('id') === id) return node
      }
      return null
    },
    querySelectorAll (selector) {
      return document.body.querySelectorAll(selector)
    },
    addEventListener () {},
    removeEventListener () {},
    activeElement: null,
    documentElement: { classList: new ClassList({}) },
  }

  document.body = new FakeNode('body')
  document.body.style = {}

  globalThis.document = document
  globalThis.Node = FakeNode
  globalThis.localStorage = localStorage
  globalThis.window = {
    matchMedia: () => ({ matches: false }),
    scrollTo: () => {},
    scrollY: 0,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage,
  }
  globalThis.fetch = () => Promise.resolve({ text: () => Promise.resolve('') })
  globalThis.requestAnimationFrame = (cb) => cb()

  return { document, localStorage }
}

// The toast lives in index.html; screens write into it.
export const seedToast = (document) => {
  const toast = document.createElement('div')
  toast.setAttribute('id', 'toast')
  document.body.appendChild(toast)
  return toast
}
