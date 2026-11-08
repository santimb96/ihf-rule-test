// Temporary bridge: the modules already converted to ESM publish themselves on
// globalThis so the screens that are still IIFEs keep working. Deleted once
// every screen imports its modules directly.
import * as Data from './data.js'
import * as Quiz from './quiz.js'
import * as Render from './render.js'
import * as Scoring from './scoring.js'
import * as Stats from './stats.js'

globalThis.IHFData = Data
globalThis.IHFQuiz = Quiz
globalThis.IHFRender = Render
globalThis.IHFScoring = Scoring
globalThis.IHFStats = Stats
