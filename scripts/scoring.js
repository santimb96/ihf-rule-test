export const PASS_RATIO = 0.75
export const SUPPORTED_LENGTHS = [5, 10, 20, 30]

// One classification per answered question, shared by the results screen and
// the stats history: an empty selection is unanswered, a net score of zero or
// less is wrong, a full sweep is correct and anything in between is partial.
export const STATUS = { correct: 'correct', partial: 'partial', wrong: 'wrong', unanswered: 'unanswered' }

export const percentage = (score, total) => {
  if (!total) return 0
  // The wrong-mark penalty can push the net score below zero; a negative
  // percentage is never shown, so it reports as 0%.
  const shown = Math.max(0, score)
  return Math.round((shown / total) * 10000) / 100
}

export const passes = (score, total) => {
  if (!total) return false
  return score / total >= PASS_RATIO
}

export const requiredCorrect = (total) => Math.ceil(PASS_RATIO * total)

// The score is counted over the possible answers, not over the questions:
// every correct option marked adds a point and every wrong option marked
// subtracts one, so a question can end up with negative points.
export const questionPoints = (selected, answer) => {
  if (!selected?.length) return 0
  const hits = selected.filter((letter) => answer.includes(letter)).length
  return hits - (selected.length - hits)
}

export const questionStatus = (selected, answer) => {
  if (!selected?.length) return STATUS.unanswered
  const points = questionPoints(selected, answer)
  if (points <= 0) return STATUS.wrong
  return points === answer.length ? STATUS.correct : STATUS.partial
}
