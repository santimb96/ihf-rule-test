import fs from 'node:fs'
import { defineConfig } from 'vite'

const VIRTUAL_ID = 'virtual:ihf-catalogue-meta'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

const LATIN_SUBSETS = [
  /(^|\/)inter-latin-wght-normal-[^/]+\.woff2$/,
  /(^|\/)archivo-latin-wght-normal-[^/]+\.woff2$/,
]

// The PDF and the two catalogues are linked by relative URL at runtime, so the
// build ships the folders verbatim instead of fingerprinting them.
const copyAssetsAndDocs = () => ({
  name: 'copy-assets-and-docs',
  closeBundle () {
    if (fs.existsSync('assets')) {
      fs.cpSync('assets', 'dist/assets', { recursive: true })
      // The hero screenshot is imported by index.html, so Vite already emits a
      // hashed copy; the verbatim folder would ship it twice.
      fs.rmSync('dist/assets/screenshots', { recursive: true, force: true })
    }
    if (fs.existsSync('documents')) {
      fs.cpSync('documents', 'dist/documents', { recursive: true })
    }
  },
})

// Font files are only discovered after the CSS applies, three levels deep.
// Hashed names exist once the bundle is emitted, so the preload links are
// injected into the generated HTML at that point. Latin only: it covers the
// Spanish accents and every other subset would be dead weight.
const preloadCriticalFonts = () => ({
  name: 'preload-critical-fonts',
  apply: 'build',
  generateBundle: {
    order: 'post',
    handler (_options, bundle) {
      const fonts = Object.keys(bundle)
        .filter((file) => LATIN_SUBSETS.some((pattern) => pattern.test(file)))
        .sort()
      if (!fonts.length) return
      const links = fonts
        .map((file) => `  <link rel="preload" as="font" type="font/woff2" crossorigin href="/${file}">`)
        .join('\n')
      Object.keys(bundle).forEach((file) => {
        const asset = bundle[file]
        if (!file.endsWith('.html') || !asset || asset.type !== 'asset') return
        asset.source = String(asset.source).replace('</head>', `${links}\n</head>`)
      })
    },
  },
})

// The setup screen needs the labels and per-topic counts, while the 330 KB
// question dataset can wait for the first test. Deriving the small module from
// data/questions.js at build time keeps both from drifting.
const catalogueMeta = () => ({
  name: 'ihf-catalogue-meta',
  resolveId (id) {
    return id === VIRTUAL_ID ? RESOLVED_ID : null
  },
  // Watched from buildStart, not load: in Vite 8 a load-context addWatchFile
  // registers the path as an added import, and "data/questions.js" is not a
  // resolvable specifier, so the next re-transform of this module fails.
  buildStart () {
    this.addWatchFile('data/questions.js')
  },
  load (id) {
    if (id !== RESOLVED_ID) return null
    const sandbox = {}
    new Function('globalThis', fs.readFileSync('data/questions.js', 'utf8'))(sandbox)
    const data = sandbox.IHF_DATA
    const counts = {}
    data.topics.forEach((topic) => {
      counts[topic.id] = 0
    })
    data.questions.forEach((question) => {
      counts[question.topic] = (counts[question.topic] || 0) + 1
    })
    return [
      `export const meta = ${JSON.stringify(data.meta)}`,
      `export const topics = ${JSON.stringify(data.topics)}`,
      `export const counts = ${JSON.stringify(counts)}`,
    ].join('\n')
  },
  configureServer (server) {
    server.watcher.on('change', (file) => {
      if (file.replace(/\\/g, '/').endsWith('data/questions.js')) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
      }
    })
  },
})

export default defineConfig({
  plugins: [copyAssetsAndDocs(), preloadCriticalFonts(), catalogueMeta()],
})
