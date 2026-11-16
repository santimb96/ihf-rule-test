// Exam mode rules and the countdown arithmetic. No DOM, no timers: the clock is
// injected so the warnings and the expiry can be tested without waiting.

export const EXAM = { size: 30, seconds: 35 * 60 }

// Announced once each, from the tightest to the loosest. Seconds left.
export const WARNING_THRESHOLDS = [5 * 60, 60]

// The deadline is an absolute timestamp, so a throttled tab or a sleeping
// machine still reports the real time left instead of drifting.
export const remainingSeconds = (deadline, now) => Math.max(0, Math.ceil((deadline - now) / 1000))

export const formatClock = (seconds) => {
  const safe = Math.max(0, Math.min(Math.floor(seconds), 99 * 60 + 59))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// Returns the threshold to announce, or null. A late tick that missed the five
// minute mark only announces the tightest one, never both.
export const warningDue = (remaining, fired = []) => {
  const due = WARNING_THRESHOLDS.filter((threshold) => remaining <= threshold && !fired.includes(threshold))
  return due.length ? Math.min(...due) : null
}

export const warningText = (threshold) => {
  const mins = Math.round(threshold / 60)
  return mins === 1 ? 'Queda 1 minuto de examen.' : `Quedan ${mins} minutos de examen.`
}
