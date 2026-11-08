export const PASS_RATIO = 0.75
export const SUPPORTED_LENGTHS = [5, 10, 20, 30]

// One classification per answered question, shared by the results screen and
// the stats history: an empty selection is unanswered, any wrong letter voids
// the question, a full sweep is correct and anything in between is partial.
export const STATUS = { correct: 'correct', partial: 'partial', wrong: 'wrong', unanswered: 'unanswered' }

export const percentage = (score, total) => {
  if (!total) return 0
  return Math.round((score / total) * 10000) / 100
}

export const passes = (score, total) => {
  if (!total) return false
  return score / total >= PASS_RATIO
}

export const requiredCorrect = (total) => Math.ceil(PASS_RATIO * total)

// The score is counted over the possible answers, not over the questions: a
// question earns points only when no wrong option is selected.
export const questionPoints = (selected, answer) => {
  if (!selected?.length) return 0
  if (selected.some((letter) => !answer.includes(letter))) return 0
  return answer.filter((letter) => selected.includes(letter)).length
}

export const questionStatus = (selected, answer) => {
  if (!selected?.length) return STATUS.unanswered
  if (selected.some((letter) => !answer.includes(letter))) return STATUS.wrong
  return questionPoints(selected, answer) === answer.length ? STATUS.correct : STATUS.partial
}
