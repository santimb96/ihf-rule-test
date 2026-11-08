# Catálogo IHF - Test reglas de juego

Web study app built on the official IHF question catalogues in `documents/`:
pick topics, pick a length (5/10/20/30), answer, check the cited guidelines
through per-question hints, see pass/fail at **>= 75%**, track your progress in
the browser and export a styled PDF report.

**Use it at <https://non-official-ihf-rule-test.netlify.app/>.** Nothing to
install: it is a static site that runs entirely in the browser, and every
attempt stays on the device.

## How to use

1. Pick the topics and the test length (5, 10, 20 or 30 questions).
2. Answer each question; the hint button shows the guidelines the catalogue
   cites for that answer.
3. Finish to see the score, the pass state (>= 75% of the possible answers) and
   a per-question review.
4. Download the report as a styled PDF, retry the missed questions, or start a
   new test.
5. Open **Estadísticas** in the header to review the history kept on this device.

## Structure

```
index.html          app shell, static hero (LCP image) and screen containers
tailwind.config.js  theme (colors, fonts, motion) moved from the inline config
postcss.config.js   tailwindcss + autoprefixer
vite.config.js      build config (copies documents/ into dist/, font preloads, catalogue meta)
styles/
  main.css          build entry: fontsource imports + @tailwind layers
  styles.css        custom CSS layer loaded after main.css (overrides utilities)
scripts/
  app.js            bundler entry: catalogue metadata + main.js
  catalogue-meta.js configures data.js with meta/topics/counts from virtual:ihf-catalogue-meta
  scoring.js        75% pass rule over the test's possible answers + question status
  quiz.js           attempt builder (shuffle, answers, report)
  stats.js          per-browser attempt history + aggregations (no DOM)
  data.js           metadata access + load() for the questions + hint parsing
  hint.js           shared collapsible hint component
  dialog.js         shared modal shell: focus trap, Escape, scroll lock
  pdf-modal.js      in-app PDF viewer for rule and document links
  render.js         DOM helpers, screen switching, icons, toast
  screens/          setup / quiz / results / stats screens (each its own chunk)
  pdf.js            jsPDF report (header, summary, accepted + failed sections)
  main.js           lifecycle wiring: imports screens on demand, jsPDF fetched on demand
data/questions.js   generated dataset (do not edit by hand); fetched on the first
                    "Comenzar test", never in the entry bundle
data/rules.js       extracted rules text: read by the tests, not shipped today
tools/extract_catalog.py   regenerates the dataset from the PDFs
tests/              node:test suite
```

## Tests

The suite covers dataset integrity, the 75%-of-answers pass rule, per-answer
grading, the shared question classification, the quiz engine, the local
statistics store and the resolution of hint citations to the rules text.

## Local statistics

Every finished attempt is stored in `localStorage` under `ihf.stats.v1`, per
browser and per device — nothing leaves the browser. Each record keeps the
timestamp, percentage, score, pass state, length, elapsed time and one entry per
question with its classification (acertada / parcial / fallada / sin responder)
and the points earned.

- The header shows **Estadísticas** only when this browser holds at least one
  attempt: the button is global to the three screens and stays out of the
  "Comenzar test" decision area. The dialog compares the recent half of the
  history against the previous half, shows the answer mix, the most practiced
  rule (primary rule from `question.rules`) and the weakest one once it has at
  least 3 questions.
- "Repetir los fallos" attempts are tagged `retry`: they count for practice and
  rule accuracy, but are excluded from the trend so re-running missed questions
  cannot make progress look worse.
- The history keeps the newest 200 attempts. Export it as JSON before clearing;
  the dialog also offers a two-step delete.
- Corrupt, foreign-version or blocked storage (private mode, quota) degrades to
  an empty history instead of breaking the app.

## Stack

Everything ships with the site; nothing loads from a CDN at runtime.

- **Tailwind CSS 3.4.16** (build-time) — utilities compiled and purged by Vite +
  PostCSS from `styles/main.css`; the theme lives in `tailwind.config.js`,
  moved verbatim from the former inline config in `index.html`. Tailwind v4 is
  deliberately not adopted: it changes default border/ring semantics and would
  be a separate visual migration.
- **Inter and Archivo variable fonts** — self-hosted `.woff2` subsets, emitted
  as cacheable assets. Archivo is imported from its `wght` subset: the design
  never uses the width axis, and `standard` (wdth+wght) is 90 KB for latin where
  `wght` is 35 KB.
- **jsPDF** — loaded with a dynamic `import()` on the first PDF download, so its
  ~342 kB stays out of the initial payload.

## Rules

- The score is counted over the number of possible answers in the test, not
  over the number of questions: a 5-question test whose questions hold 9
  correct answers is scored out of 9 (`5/6 -> 83.33%`).
- A question earns one point per correct option selected and zero when any wrong
  option is selected; a partial selection of correct options still counts.
- Pass mark: `score / totalAnswers >= 0.75` (5/6, 7/9, 15/20), shown with two
  decimals.
- Hints show the guidelines cited by the answer catalogue, deep-linked into the
  Rules of Game PDF when the reference resolves to a known chapter.
