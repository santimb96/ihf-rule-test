// Build entry. Only the first paint is imported here: the setup screen and the
// shared helpers. The quiz and results screens, the statistics dialog and the
// PDF pipeline are fetched by main.js on the first click that needs them, and
// the question dataset is fetched by data.load() when a test starts.
import './catalogue-meta.js'
import './legacy-globals.js'
import './screens/setup.js'
import './main.js'
