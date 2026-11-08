# Catálogo IHF - Test reglas de juego

Local study platform built on the official IHF question catalogues in `documents/`:
pick topics, pick a length (5/10/20/30), answer, check the cited guidelines through
per-question hints, see pass/fail at **>= 75%**, track your progress in the browser
and export a styled PDF report.

## Run

Requires Node 22+ and pnpm 10 (`packageManager` pins `pnpm@10.34.9`):

```bash
pnpm install
pnpm dev        # dev server at http://localhost:5173
pnpm build      # production build into dist/
pnpm preview    # serve dist/ locally
```

The build is a static site: deploy `dist/` to Netlify or Vercel (both configs
are included, `netlify.toml` and `vercel.json`). Nothing loads from a CDN at
runtime — styles, fonts and jsPDF all ship from the project.

## Dependencies

Managed with pnpm; the browser never talks to a CDN:

- `tailwindcss` 3.4.16 (build-time) — utilities compiled and purged by Vite +
  PostCSS from `styles/main.css`; the theme lives in `tailwind.config.js`
  (moved verbatim from the former inline config in `index.html`). Tailwind v4 is
  deliberately not adopted: it changes default border/ring semantics and would
  be a separate visual migration.
- `@fontsource-variable/inter`, `@fontsource-variable/archivo` — self-hosted
  variable fonts (all subsets), emitted as cacheable `.woff2` assets. Replaces
  the Google Fonts stylesheet. Archivo is imported from its `wght` subset: the
  design never uses the width axis, and `standard` (wdth+wght) is 90 KB for
  latin where `wght` is 35 KB.
- `jspdf` 2.5.2 — lazy-loaded with a dynamic `import()` on the first PDF
  download, so its ~342 kB stays out of the initial payload.

```bash
pnpm add jspdf@2.5.2                 # runtime dependency
pnpm add -D tailwindcss@3.4.16 vite  # build tooling
```

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
data/rules.js       extracted rules text: read by tests/tools only, not shipped
tools/extract_catalog.py   regenerates the dataset from the PDFs
tests/              node:test suite
odd/tasks/          feature document (specs, tasks, log)
```

## Tests

```bash
pnpm test          # node --test tests/*.test.mjs
pnpm lint          # eslint flat config: no semicolons, single quotes, 2-space
```

Covers dataset integrity, the 75%-of-answers pass rule, per-answer grading, the
shared question classification, the quiz engine and the local statistics store.
Note: `tests/rules.test.mjs` currently has 5 pre-existing failures (dataset text
extraction, pending task T8); they reproduce on a clean checkout too.

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

## Regenerate the dataset

```bash
pip3 install pdfplumber
python3 tools/extract_catalog.py
```

The Spanish catalogue provides questions, options and topics; the English answer
key provides the correct options and the cited guidelines; both are joined by
question id and validated (ids, option letters, answer subsets, guidelines).

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
