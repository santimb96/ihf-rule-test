import { passes, percentage, questionPoints, questionStatus, requiredCorrect } from './scoring.js'

// Fisher-Yates, so a fixed rng makes attempts reproducible in tests.
export const shuffle = (items, rng) => {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const swap = out[i]
    out[i] = out[j]
    out[j] = swap
  }
  return out
}

export const createQuiz = ({ pool = [], size, rng = Math.random }) => {
  const count = Math.min(size, pool.length)
  const items = shuffle(pool, rng).slice(0, count)
  const selected = items.map(() => [])

  return {
    items,

    select (index, letters) {
      selected[index] = letters.slice()
    },

    selected (index) {
      return selected[index].slice()
    },

    answeredCount () {
      return selected.filter((letters) => letters.length > 0).length
    },

    report () {
      let score = 0
      let totalAnswers = 0

      const results = items.map((question, index) => {
        const picked = selected[index]
        const points = questionPoints(picked, question.answer)
        score += points
        totalAnswers += question.answer.length
        return {
          question,
          selected: picked.slice(),
          points,
          status: questionStatus(picked, question.answer),
          correct: points === question.answer.length,
        }
      })

      const correct = results.filter((result) => result.correct).length

      return {
        total: items.length,
        totalAnswers,
        score,
        correct,
        results,
        percentage: percentage(score, totalAnswers),
        passed: passes(score, totalAnswers),
        required: requiredCorrect(totalAnswers),
      }
    },
  }
}
