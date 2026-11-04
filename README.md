# IHF Rules Trainer

Local study platform built on the official IHF question catalogues in `documents/`:
pick topics, pick a length (5/10/20/30), answer, check the cited guidelines through
per-question hints, see pass/fail at **>= 75%** and export a styled PDF report.

## Run

Open `index.html` directly in a browser (double click). Everything runs locally;
only Tailwind, fonts, jsPDF and the Google fonts load from their CDNs.

Optional local server:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Structure

```
index.html          app shell, CDN wiring, screen containers
styles/             custom CSS layer on top of Tailwind (theme, motion, components)
scripts/
  scoring.js        75% pass rule over the test's possible answers
  quiz.js           attempt builder (shuffle, answers, report)
  data.js           dataset access + guidelines parsing for hints
  hint.js           shared collapsible hint component
  render.js         DOM helpers, screen switching, icons, toast
  screens/          setup / quiz / results screens
  pdf.js            jsPDF report (header, summary, accepted + failed sections)
  main.js           lifecycle wiring
data/questions.js   generated dataset (do not edit by hand)
tools/extract_catalog.py   regenerates the dataset from the PDFs
tests/              node:test suite
odd/tasks/          feature document (specs, tasks, log)
```

## Tests

```bash
node --test tests/*.test.mjs
```

Covers dataset integrity, the 75%-of-answers pass rule, per-answer grading and the quiz engine.

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
