const RULES_PDF = 'documents/Reglas de Juego (Septiembre 2025) Web.pdf'

// Chapter starts for references that are not plain rule paragraphs.
const SPECIAL_PAGES = [
  { test: /aclaraci[oó]n|clarification/i, page: 68 },
  { test: /directriz|guideline/i, page: 95 },
  { test: /zona de cambios|substitution area/i, page: 92 },
  { test: /ap[eé]ndice|appendix/i, page: 68 },
]

const ORDINALS = { first: '1er', second: '2º', third: '3er' }

// The metadata ships with the first paint and the 330 KB dataset arrives later,
// on the first test. The tests derive the metadata from the dataset instead.
let catalogue = null
let loading = null

const dataset = () => globalThis.IHF_DATA || null

const countTopics = (data) => {
  const counts = {}
  data.topics.forEach((topic) => {
    counts[topic.id] = 0
  })
  data.questions.forEach((question) => {
    counts[question.topic] = (counts[question.topic] || 0) + 1
  })
  return counts
}

const ensureMeta = () => {
  if (!catalogue) {
    const data = dataset()
    if (!data) throw new Error('catalogue metadata is not configured')
    catalogue = { meta: data.meta, topics: data.topics, counts: countTopics(data) }
  }
  return catalogue
}

const requireDataset = (what) => {
  const data = dataset()
  if (!data) throw new Error(`question dataset not loaded; call load() before ${what}`)
  return data
}

const translate = (segment) => {
  if (/^electronic team time-out regulations$/i.test(segment)) return 'Reglamento de tiempo muerto electrónico'
  if (/^video replay regulations$/i.test(segment)) return 'Reglamento de video replay'

  const area = segment.match(/^substitution area regulations\s*(.*)$/i)
  if (area) return area[1] ? `Reglamento de zona de cambios ${area[1]}` : 'Reglamento de zona de cambios'

  if (/^regulations on protective equipment and accessories$/i.test(segment)) {
    return 'Reglamento de equipación y accesorios protectores'
  }

  const appendix = segment.match(/^appendix\s*(.*)$/i)
  if (appendix) return `Apéndice ${appendix[1]}`
  if (/^hand signals$/i.test(segment)) return 'Gestoformas'

  const related = segment.match(/^in connection with\s*(.*)$/i)
  if (related) return `en relación con ${related[1]}`

  return null
}

const labelFor = (segment) => {
  const text = segment.trim()

  const rule = text.match(/^(\d{1,2})[:.](\d+[a-z]?(?:-\d+[a-z])?)([\s\S]*)$/i)
  if (rule) {
    const label = `Regla ${rule[1]}:${rule[2]}`
    const tail = rule[3].trim()
    if (!tail) return label
    if (/^comments?$/i.test(tail)) return `${label} (comentario)`
    if (/^note$/i.test(tail)) return `${label} (nota)`
    if (/hand signals/i.test(tail)) return `${label} (gestoformas)`
    if (/^and guideline/i.test(tail)) return `${label} + directriz`
    return `${label} · ${tail}`
  }

  const clarification = text.match(/^(?:clarification|aclaraci[oó]n)\s*(?:no\.?\s*)?([\s\S]*)$/i)
  if (clarification) {
    const rest = (clarification[1] || '').trim().replace(/\band\b/gi, 'y')
    return rest ? `Aclaración ${rest}` : 'Aclaración'
  }

  if (/^guidelines$/i.test(text)) return 'Directrices'
  if (/^new guideline$/i.test(text)) return 'Directriz nueva'

  const guidelineRule = text.match(/^guideline\s+rule\s+([\s\S]*)$/i)
  if (guidelineRule) return `Directriz regla ${guidelineRule[1]}`

  const guideline = text.match(/^guideline\s+([\s\S]*)$/i)
  if (guideline) return guideline[1].trim() ? `Directriz ${guideline[1].trim()}` : 'Directriz'

  const ordinal = text.match(/^(\d+)(?:st|nd|rd|th)\s+paragraph$/i)
  if (ordinal) return `${ordinal[1]}º párrafo`

  const ordinalWord = text.match(/^(first|second|third)\s+paragraph$/i)
  if (ordinalWord) return `${ORDINALS[ordinalWord[1].toLowerCase()]} párrafo`

  const paragraph = text.match(/^paragraph\s+(\d+)$/i)
  if (paragraph) return `Párrafo ${paragraph[1]}`

  if (/^comments$/i.test(text)) return 'Comentarios'
  if (/^comment$/i.test(text)) return 'Comentario'
  if (/^note$/i.test(text)) return 'Nota'

  return translate(text) || text
}

const topicPage = (id) => ensureMeta().topics.find((topic) => topic.id === id)?.rulesPage

const pageFor = (segment, question) => {
  const rule = segment.match(/^(\d{1,2})[:.]/)
  if (rule && topicPage(rule[1])) return topicPage(rule[1])

  const special = SPECIAL_PAGES.find((entry) => entry.test.test(segment))
  if (special) return special.page

  // Standalone regulations (video replay, team time-out) are not in the PDF.
  if (/regulations/i.test(segment) && !/substitution area/i.test(segment)) return null
  return topicPage(question.topic) || null
}

export const configureCatalogue = (bundle) => {
  catalogue = bundle
}

export const getMeta = () => ensureMeta().meta

export const topics = () => ensureMeta().topics

export const questions = () => requireDataset('reading the questions').questions

export const topicLabel = (id) => ensureMeta().topics.find((topic) => topic.id === id)?.label || id

// Number of questions a topic selection would draw from, without the dataset.
export const poolSize = (topicIds) => {
  const { counts } = ensureMeta()
  return topicIds.reduce((sum, id) => sum + (counts[id] || 0), 0)
}

export const pool = (topicIds) => {
  const wanted = new Set(topicIds)
  return requireDataset('building the test').questions.filter((question) => wanted.has(question.topic))
}

export const loaded = () => !!dataset()

// Fetches the dataset once; the promise is cached and retried on failure.
export const load = () => {
  if (dataset()) return Promise.resolve(dataset())
  if (!loading) {
    loading = import('../data/questions.js')
      .then(() => requireDataset('starting the test'))
      .catch((error) => {
        loading = null
        throw error
      })
  }
  return loading
}

export const chips = (question) => {
  const seen = new Set()
  return question.rules
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const label = labelFor(segment)
      if (seen.has(label)) return null
      seen.add(label)
      return { raw: segment, label, page: pageFor(segment, question) }
    })
    .filter(Boolean)
}

export const rulesUrl = (page) => (page ? `${encodeURI(RULES_PDF)}#page=${page}` : null)
