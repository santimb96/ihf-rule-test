/**
 * Build entry. The application modules are IIFEs that publish themselves on
 * globalThis, so the bundler only has to guarantee execution order: the
 * dataset before scripts/data.js (it throws at init when IHF_DATA is missing),
 * render/hint before the screens, and scripts/main.js last.
 */
import "../data/rules.js";
import "../data/questions.js";
import "./scoring.js";
import "./quiz.js";
import "./stats.js";
import "./data.js";
import "./render.js";
import "./hint.js";
import "./screens/setup.js";
import "./screens/quiz.js";
import "./screens/results.js";
import "./screens/stats.js";
import "./pdf.js";
import "./main.js";
