/**
 * Build entry. The application modules are IIFEs that publish themselves on
 * globalThis, so the bundler only has to guarantee execution order: the
 * catalogue metadata before scripts/data.js, render before the screens, and
 * scripts/main.js last.
 *
 * Only what the first paint needs is loaded here: the setup screen and the
 * shared helpers. The quiz/results screens, the hints, the statistics dialog and
 * the PDF pipeline are fetched by scripts/main.js on the first click that needs
 * them, and the 330 KB question dataset is fetched by IHFData.load() when a test
 * starts. data/rules.js (243 KB of extracted rules text) is read only by the
 * extraction tests, never by the running app, so it is not imported at all.
 */
import "./catalogue-meta.js";
import "./scoring.js";
import "./quiz.js";
import "./stats.js";
import "./data.js";
import "./render.js";
import "./screens/setup.js";
import "./main.js";
