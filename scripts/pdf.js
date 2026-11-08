/**
 * Styled PDF report built with jsPDF and aligned with the on-screen design
 * system: brand navy band with handball-court line art, Archivo for display
 * text (same face as the web headings), a score ring, status pills with the
 * same four review states as the results screen, and a fixed margin grid.
 */

import { toast } from './render.js'
import { topics, topicLabel, chips } from './data.js'

// --- page grid (mm) ------------------------------------------------------
const PAGE = { w: 210, h: 297 }
const X0 = 15 // outer left margin
const X1 = PAGE.w - 15 // outer right margin
const CONTENT_W = X1 - X0 // 180

const FOOT_Y = 282 // footer rule
const BOTTOM = 276 // content must stop above the footer
const BAND1 = 38 // cover header band
const BANDN = 16 // running header band
const BAND_ACCENT = 1.4 // amber rule under every band
const START1 = BAND1 + BAND_ACCENT + 8 // 47.4
const STARTN = BANDN + BAND_ACCENT + 6 // 23.4

const SP = { s: 3.5, m: 5, l: 8 } // vertical rhythm between blocks
const BLOCK_GAP = 5 // gap between two question blocks
const RADIUS = { panel: 1.6, control: 1.0 } // 6px / 4px at web scale

const MM_PT = 25.4 / 72
const lh = (size, mult) => size * (mult || 1.4) * MM_PT

// --- type scale ----------------------------------------------------------
const TYPE = {
  display: { size: 25, style: 'bold' },
  title: { size: 18.5, style: 'bold' },
  h1: { size: 13, style: 'bold' },
  h2: { size: 10.5, style: 'bold' },
  body: { size: 9.5, style: 'normal' },
  small: { size: 8.5, style: 'normal' },
  quote: { size: 8, style: 'italic' },
  caption: { size: 7.5, style: 'normal' },
}

// --- palette: the web's brand tokens -------------------------------------
const C = {
  brand950: [20, 28, 74], // #141c4a
  brand900: [30, 44, 116], // #1e2c74
  brand700: [30, 51, 184], // #1e33b8
  brand600: [37, 66, 230], // #2542e6
  brand200: [168, 188, 236],
  amber: [245, 158, 11], // #f59e0b accent
  amberDark: [146, 64, 14], // #92400e
  amberTint: [254, 243, 199], // #fef3c7
  amberWash: [255, 251, 235], // #fffbeb
  amberLine: [253, 230, 138], // #fde68a
  green: [5, 150, 105], // #059669
  greenDark: [4, 120, 87], // #047857
  greenTint: [209, 250, 229], // #d1fae5
  greenWash: [236, 253, 245], // #ecfdf5
  greenLine: [167, 243, 208], // #a7f3d0
  rose: [225, 29, 72], // #e11d48
  roseDark: [190, 18, 60], // #be123c
  roseTint: [255, 228, 230], // #ffe4e6
  roseWash: [255, 241, 242], // #fff1f2
  roseLine: [254, 205, 211], // #fecdd3
  slateTint: [241, 245, 249], // #f1f5f9
  slateWash: [248, 250, 252], // #f8fafc
  ink: [11, 18, 32], // #0b1220
  slate: [71, 85, 105], // #475569
  muted: [100, 116, 139], // #64748b
  line: [226, 232, 240], // #e2e8f0
  card: [248, 250, 252], // #f8fafc
  badge: [148, 163, 184], // #94a3b8
  white: [255, 255, 255],
}

/**
 * The four review states of the results screen, replicated exactly:
 * accepted (all correct options picked, no wrong one), partial (a correct
 * subset without mistakes), failed (a wrong option was picked) and
 * unanswered (nothing selected).
 */
const STATUS = {
  accepted: { label: 'ACERTADA', accent: C.green, dark: C.greenDark, tint: C.greenTint, wash: C.greenWash, line: C.greenLine },
  partial: { label: 'PARCIAL', accent: C.amber, dark: C.amberDark, tint: C.amberTint, wash: C.amberWash, line: C.amberLine },
  failed: { label: 'FALLADA', accent: C.rose, dark: C.roseDark, tint: C.roseTint, wash: C.roseWash, line: C.roseLine },
  unanswered: { label: 'SIN RESPONDER', accent: C.badge, dark: C.slate, tint: C.slateTint, wash: C.slateWash, line: C.line },
}

export const STATUS_LABELS = {
  accepted: STATUS.accepted.label,
  partial: STATUS.partial.label,
  failed: STATUS.failed.label,
  unanswered: STATUS.unanswered.label,
}

const OPTION_TINT = {
  hit: C.greenTint,
  missed: C.amberTint,
  wrong: C.roseTint,
  neutral: null,
}
const OPTION_BADGE = { hit: C.green, missed: C.amber, wrong: C.rose, neutral: C.badge }
const OPTION_TEXT = { hit: C.greenDark, missed: C.amberDark, wrong: C.roseDark, neutral: C.slate }

const PILL_PAD = 5.5 // equal left/right padding inside every pill, charSpace included
const BLOCK = { padT: 5, padB: 5, rule: 1 }
const IX = X0 + 7 // inner text left
const IR = X1 - 6 // inner text right
const IW = IR - IX
const TINT_X = IX - 3 // option tint band
const TINT_W = IR + 3 - TINT_X

export const statusOf = (result) => {
  const answer = (result.question && result.question.answer) || []
  const selected = result.selected || []
  if (result.correct) return 'accepted'
  if (!selected.length) return 'unanswered'
  const wrong = selected.some((letter) => !answer.includes(letter))
  return wrong ? 'failed' : 'partial'
}

/** The file name repeats the answer score shown in the summary card. */
export const filenameFor = (report, stamp) =>
  `ihf-test-${report.score}-de-${report.totalAnswers}-${stamp}.pdf`

// jsPDF standard fonts only cover Latin-1, so normalise typographic glyphs.
export const sanitize = (text) =>
  String(text)
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/≠/g, '!=')
    .replace(/[×✕]/g, 'x')
    .replace(/→/g, '->')
    .replace(/′/g, "'")
    .replace(/″/g, '"')
    .replace(/•/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')

// --- assets --------------------------------------------------------------
const toBase64 = (bytes) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

const loadAsset = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

export const generate = async (report, config) => {
  let jsPDF
  try {
    ({ jsPDF } = await import('jspdf'))
  } catch {
    toast('No se pudo cargar la librería PDF. Revisa tu conexión.')
    return null
  }

  // The display face and the logo are optional: without them the report
  // falls back to Helvetica and the amber "R" tile, never to a broken PDF.
  let fontB64 = null
  let logoData = null
  try {
    fontB64 = toBase64(await loadAsset('assets/fonts/archivo-bold.ttf'))
  } catch {
    fontB64 = null
  }
  try {
    logoData = `data:image/png;base64,${toBase64(await loadAsset('assets/logo-handball-white.png'))}`
  } catch {
    logoData = null
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  let DISPLAY = 'helvetica'
  if (fontB64) {
    try {
      doc.addFileToVFS('Archivo-Bold.ttf', fontB64)
      doc.addFont('Archivo-Bold.ttf', 'Archivo', 'bold')
      DISPLAY = 'Archivo'
    } catch {
      DISPLAY = 'helvetica'
    }
  }

  let y = 0
  let pageNo = 1

  // --- drawing primitives -----------------------------------------------
  const setColor = (rgb) => {
    doc.setTextColor(rgb[0], rgb[1], rgb[2])
  }

  const setFill = (rgb) => {
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
  }

  const setDraw = (rgb) => {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2])
  }

  const rrect = (x, yy, w, h, r, style) => {
    doc.roundedRect(x, yy, w, h, r, r, style)
  }

  const txt = (str, x, yy, options = {}) => {
    const { family, style, size, color, align, baseline, charSpace } = options
    doc.setFont(family || 'helvetica', style || 'normal')
    doc.setFontSize(size || TYPE.body.size)
    setColor(color || C.ink)
    doc.text(sanitize(str), x, yy, {
      align: align || 'left',
      baseline: baseline || 'alphabetic',
      charSpace: charSpace || 0,
    })
  }

  /** Display text: Archivo when embedded, bold Helvetica otherwise. */
  const display = (str, x, yy, options = {}) => {
    const { size, color, align, baseline, charSpace } = options
    txt(str, x, yy, {
      family: DISPLAY,
      style: 'bold',
      size: size || TYPE.h1.size,
      color: color || C.ink,
      align,
      baseline,
      charSpace,
    })
  }

  const wrap = (str, style, size, width, family) => {
    doc.setFont(family || 'helvetica', style)
    doc.setFontSize(size)
    return doc.splitTextToSize(sanitize(str), width)
  }

  const textWidth = (str, style, size, family) => {
    doc.setFont(family || 'helvetica', style)
    doc.setFontSize(size)
    return doc.getTextWidth(sanitize(str))
  }

  const pillWidth = (str, style, size, family, charSpace) => {
    let w = textWidth(str, style, size, family)
    if (charSpace) w += charSpace * Math.max(0, String(str).length - 1)
    return w + PILL_PAD * 2
  }

  /** Draws pre-wrapped lines from a block top and returns the block height. */
  const linesBlock = (lines, x, yTop, size, style, color, step, family) => {
    doc.setFont(family || 'helvetica', style)
    doc.setFontSize(size)
    setColor(color)
    lines.forEach((line, i) => {
      doc.text(line, x, yTop + size * MM_PT * 0.76 + i * step)
    })
    return lines.length * step
  }

  // --- handball court line art, bleeding off the page like the web hero ---
  const courtFull = (x, yTop, w) => {
    const u = w / 400 // 400 x 200 court units
    const px = (v) => x + v * u
    const py = (v) => yTop + v * u
    const strokeArc = (cx, cy, r, a0, a1, steps) => {
      let prevX = px(cx) + r * u * Math.cos(a0)
      let prevY = py(cy) + r * u * Math.sin(a0)
      for (let i = 1; i <= steps; i++) {
        const a = a0 + ((a1 - a0) * i) / steps
        const nx = px(cx) + r * u * Math.cos(a)
        const ny = py(cy) + r * u * Math.sin(a)
        doc.line(prevX, prevY, nx, ny)
        prevX = nx
        prevY = ny
      }
    }

    doc.setLineWidth(0.45)
    setDraw(C.white)
    doc.setGState(new doc.GState({ opacity: 0.8 }))

    doc.rect(px(1.5), py(1.5), 397 * u, 197 * u, 'S')
    doc.line(px(200), py(1.5), px(200), py(198.5))
    // Left goal area: goal line -> arc -> 3 m front line -> arc -> goal line.
    strokeArc(0, 85, 60, -Math.PI / 2, 0, 16)
    doc.line(px(60), py(85), px(60), py(115))
    strokeArc(0, 115, 60, 0, Math.PI / 2, 16)
    // Right goal area.
    strokeArc(400, 85, 60, -Math.PI / 2, -Math.PI, 16)
    doc.line(px(340), py(85), px(340), py(115))
    strokeArc(400, 115, 60, Math.PI, Math.PI / 2, 16)
    // Goals.
    doc.setLineWidth(1.3)
    doc.line(px(1.5), py(85), px(1.5), py(115))
    doc.line(px(398.5), py(85), px(398.5), py(115))

    doc.setGState(new doc.GState({ opacity: 1 }))
    return 200 * u
  }

  // --- header bands ------------------------------------------------------
  const lerpColor = (a, b, t) => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]

  /** Stepped gradient that reads as the web hero (brand-950 -> 900 -> 700). */
  const paintBandGradient = (h) => {
    const steps = 72
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1)
      setFill(t < 0.5 ? lerpColor(C.brand950, C.brand900, t * 2) : lerpColor(C.brand900, C.brand700, (t - 0.5) * 2))
      doc.rect((PAGE.w / steps) * i, 0, PAGE.w / steps + 0.15, h, 'F')
    }
  }

  const header = (first) => {
    const band = first ? BAND1 : BANDN
    setFill(C.white)
    doc.rect(0, 0, PAGE.w, PAGE.h, 'F')
    paintBandGradient(band)
    setFill(C.amber)
    doc.rect(0, band, PAGE.w, BAND_ACCENT, 'F')

    if (first) {
      // Full court, larger than the band, cropped by the page edge.
      courtFull(126, -7, 104)

      if (logoData) {
        try {
          doc.addImage(logoData, 'PNG', X0, 10.5, 15, 15)
        } catch {
          logoData = null
        }
      }
      if (!logoData) {
        setFill(C.amber)
        rrect(X0, 10.5, 15, 15, RADIUS.panel, 'F')
        display('R', X0 + 7.5, 18.4, {
          size: 11,
          color: C.brand950,
          align: 'center',
          baseline: 'middle',
        })
      }

      display('INFORME DE RESULTADOS', X0 + 21, 12, {
        size: TYPE.caption.size,
        color: C.amber,
        charSpace: 1.2,
      })
      display('Catálogo IHF - Test reglas de juego', X0 + 21, 23, {
        size: TYPE.title.size,
        color: C.white,
        charSpace: 0.2,
      })
      txt('Test no oficial · Catálogo oficial IHF (jul 2025)', X0 + 21, 30.5, {
        size: TYPE.small.size,
        color: C.brand200,
      })
    } else {
      display('Catálogo IHF - Test reglas de juego', X0, 11, { size: TYPE.h2.size, color: C.white })
      txt('Test no oficial · Informe de resultados', X1, 11, {
        size: TYPE.caption.size,
        color: C.brand200,
        align: 'right',
      })
    }
    y = first ? START1 : STARTN
  }

  const newPage = () => {
    doc.addPage()
    pageNo += 1
    header(false)
  }

  const ensureSpace = (h) => {
    if (y + h > BOTTOM) newPage()
  }

  // --- score ring (mirrors the results ring) -----------------------------
  const ring = (cx, cy, r, pct, color) => {
    doc.setLineWidth(3.2)
    setDraw(C.line)
    doc.circle(cx, cy, r, 'S')
    const p = Math.max(0, Math.min(100, pct))
    if (p > 0) {
      const steps = Math.max(4, Math.round((p / 100) * 120))
      const a0 = -Math.PI / 2
      const a1 = a0 + (p / 100) * Math.PI * 2
      setDraw(color)
      let prevX = cx + r * Math.cos(a0)
      let prevY = cy + r * Math.sin(a0)
      for (let i = 1; i <= steps; i++) {
        const a = a0 + ((a1 - a0) * i) / steps
        const nx = cx + r * Math.cos(a)
        const ny = cy + r * Math.sin(a)
        doc.line(prevX, prevY, nx, ny)
        prevX = nx
        prevY = ny
      }
    }
  }

  // --- summary card ------------------------------------------------------
  const summaryCard = () => {
    const { passed, score, totalAnswers, percentage, required, total, elapsedTime } = report
    const topicsText =
      config.topics.length === topics().length ? 'Todos los temas' : config.topics.map((id) => topicLabel(id)).join(', ')

    const innerX = X0 + 8 + 27 + 8 // card pad + ring diameter + gap
    const innerW = X1 - 8 - innerX
    const pad = 8
    const tone = passed ? STATUS.accepted : STATUS.failed
    const headline = passed ? '¡Enhorabuena, has aprobado!' : '¡Esta vez no ha sido posible!'
    const sentence = passed
      ? `Has acertado ${score} de ${totalAnswers} respuestas (${percentage}%), por encima del 75% exigido.`
      : `Has acertado ${score} de ${totalAnswers} respuestas (${percentage}%). Necesitabas ${required} respuestas correctas para aprobar (75%).`
    const details = [
      `${total}${total === 1 ? ' pregunta' : ' preguntas'}`,
      `Mínimo para aprobar: ${required}${required === 1 ? ' respuesta' : ' respuestas'} (75%)`,
      elapsedTime !== undefined ? `Tiempo: ${Math.floor(elapsedTime / 60)}m ${elapsedTime % 60}s` : null,
    ]
      .filter(Boolean)
      .join(' · ')

    const stmtStep = lh(TYPE.body.size, 1.4)
    const smallStep = lh(TYPE.small.size, 1.4)
    const capStep = lh(TYPE.caption.size, 1.4)
    const sLines = wrap(sentence, 'normal', TYPE.body.size, innerW)
    const dLines = wrap(details, 'normal', TYPE.small.size, innerW)
    const tLines = wrap(`Temas: ${topicsText}`, 'normal', TYPE.caption.size, innerW)
    const headlineH = lh(TYPE.h1.size, 1.2)
    const pillH = 8
    const contentH =
      pillH + 3.2 + headlineH + 3.2 + sLines.length * stmtStep + 2 + dLines.length * smallStep + 1.5 + tLines.length * capStep
    const cardH = Math.max(27 + pad * 2, contentH + pad * 2)

    setFill(C.white)
    setDraw(C.line)
    doc.setLineWidth(0.35)
    rrect(X0, y, CONTENT_W, cardH, RADIUS.panel, 'FD')

    // Ring column.
    const cx = X0 + pad + 13.5
    const cy = y + cardH / 2
    ring(cx, cy, 13.5, percentage, tone.accent)
    display(`${percentage}%`, cx, cy - 1.4, {
      size: 14,
      color: C.ink,
      align: 'center',
      baseline: 'middle',
    })
    txt('respuestas', cx, cy + 5.4, {
      size: 6.2,
      color: C.muted,
      align: 'center',
      baseline: 'middle',
    })

    // Copy column.
    const top = y + pad
    const pillText = passed ? 'APROBADO' : 'NO APROBADO'
    const pw = pillWidth(pillText, 'bold', TYPE.small.size, DISPLAY, 0.4)
    setFill(tone.accent)
    rrect(innerX, top, pw, pillH, pillH / 2, 'F')
    txt(pillText, innerX + pw / 2, top + pillH / 2, {
      family: DISPLAY,
      style: 'bold',
      size: TYPE.small.size,
      color: C.white,
      align: 'center',
      baseline: 'middle',
      charSpace: 0.4,
    })

    const headlineBaseline = top + pillH + 4.6
    display(headline, innerX, headlineBaseline, { size: TYPE.h1.size, color: C.ink })
    let cursor = headlineBaseline + 3.2
    cursor += linesBlock(sLines, innerX, cursor, TYPE.body.size, 'normal', C.slate, stmtStep) + 2
    cursor += linesBlock(dLines, innerX, cursor, TYPE.small.size, 'normal', C.slate, smallStep) + 1.5
    linesBlock(tLines, innerX, cursor, TYPE.caption.size, 'normal', C.muted, capStep)

    y += cardH + SP.l
  }

  const legend = () => {
    const top = y
    // Same four labels as the results screen legend.
    const items = [
      { c: C.green, label: 'Acertada' },
      { c: C.amber, label: 'Correcta que no marcaste' },
      { c: C.rose, label: 'Fallada' },
      { c: C.badge, label: 'Sin responder' },
    ]
    let x = X0
    items.forEach((it) => {
      setFill(it.c)
      rrect(x, top + 0.6, 2.6, 2.6, 0.8, 'F')
      txt(it.label, x + 4.2, top + 1.9, { size: TYPE.caption.size, color: C.slate, baseline: 'middle' })
      x += 4.2 + textWidth(it.label, 'normal', TYPE.caption.size) + 8
    })

    const note =
      'Cada bloque marca en verde las respuestas correctas que elegiste, en ámbar las correctas que no marcaste, en rojo las incorrectas marcadas y en gris lo que quedó sin marcar. La barra del margen derecho repite el estado de la pregunta.'
    const lines = wrap(note, 'normal', TYPE.caption.size, CONTENT_W)
    const h = linesBlock(lines, X0, top + 8, TYPE.caption.size, 'normal', C.muted, lh(TYPE.caption.size, 1.45))
    y = top + 8 + h + SP.l
  }

  // --- section title -----------------------------------------------------
  const sectionTitle = (label, count, tone) => {
    ensureSpace(50)
    const top = y
    display(label, X0, top + 7, { size: TYPE.h1.size, color: tone.accent, baseline: 'middle' })
    const labelW = textWidth(label, 'bold', TYPE.h1.size, DISPLAY)

    const countText = String(count)
    const pillW = pillWidth(countText, 'bold', TYPE.small.size, DISPLAY, 0)
    setFill(tone.accent)
    rrect(X0 + labelW + 6, top + 3, pillW, 8, 4, 'F')
    txt(countText, X0 + labelW + 6 + pillW / 2, top + 7, {
      family: DISPLAY,
      style: 'bold',
      size: TYPE.small.size,
      color: C.white,
      align: 'center',
      baseline: 'middle',
    })

    // Accent segment + hairline, the same motif as the footer rule.
    setFill(tone.accent)
    doc.rect(X0, top + 14.6, 30, 0.9, 'F')
    setDraw(C.line)
    doc.setLineWidth(0.3)
    doc.line(X0 + 30, top + 15.05, X1, top + 15.05)

    y = top + 15.05 + SP.l
  }

  // --- question blocks ---------------------------------------------------
  const layoutQuestion = (result) => {
    const { question: q, selected } = result
    const chipList = chips(q)
    const chipText = chipList.map((chip) => chip.label).join('  |  ')
    const status = statusOf(result)
    const tone = STATUS[status]
    const pillText = tone.label

    const stmtStep = lh(TYPE.body.size, 1.4)
    const stmtLines = wrap(q.text, 'bold', TYPE.body.size, IW)

    const optRows = q.options.map((o) => {
      // Same four option states as the review screen: hit (picked), missed
      // (correct but not picked), wrong (picked and incorrect), plain.
      const inKey = q.answer.includes(o.letter)
      const picked = selected.includes(o.letter)
      const kind = inKey && picked ? 'hit' : inKey ? 'missed' : picked ? 'wrong' : 'neutral'
      const style = kind === 'neutral' ? 'normal' : 'bold'
      const step = lh(TYPE.body.size, 1.4)
      const lines = wrap(o.text, style, TYPE.body.size, IW - 10.5)
      return { letter: o.letter, kind, style, lines, step, h: Math.max(8, lines.length * step + 3) }
    })

    const hintStep = lh(TYPE.quote.size, 1.42)
    const hintLines = wrap(`Directrices: ${chipText || q.rules}`, TYPE.quote.style, TYPE.quote.size, TINT_W - 10)
    const hintH = hintLines.length * hintStep + 6

    // The header row stays whole; the statement flows line by line so a
    // block can start near the bottom of a page without leaving a gap.
    const elements = [
      {
        h: 12,
        draw: (cy) => {
          drawHeadRow(result, tone, pillText, cy)
        },
      },
    ]
    stmtLines.forEach((line) => {
      elements.push({
        h: stmtStep,
        draw: (cy) => {
          drawStatementLine(line, cy)
        },
      })
    })
    elements.push({ h: SP.s, draw: () => {} })
    optRows.forEach((row) => {
      elements.push({
        h: row.h,
        draw: (cy) => {
          drawOption(row, cy)
        },
      })
    })
    elements.push({
      h: SP.m + 5.5,
      draw: (cy) => {
        drawCorrect(result, tone, cy + SP.m)
      },
    })
    elements.push({
      h: SP.s + hintH,
      draw: (cy) => {
        drawHint(hintLines, hintStep, cy + SP.s)
      },
    })

    const total = elements.reduce((sum, el) => sum + el.h, 0)

    return { tone, elements, total }
  }

  const drawHeadRow = (result, tone, pillText, cy) => {
    const { question: q, selected } = result
    const rowCenter = cy + 3.25 // one shared centre line for the whole row

    const pw = pillWidth(pillText, 'bold', TYPE.caption.size, DISPLAY, 0.3)
    setFill(tone.accent)
    rrect(IX, cy, pw, 6.5, 3.25, 'F')
    txt(pillText, IX + pw / 2, rowCenter, {
      family: DISPLAY,
      style: 'bold',
      size: TYPE.caption.size,
      color: C.white,
      align: 'center',
      baseline: 'middle',
      charSpace: 0.3,
    })

    const idText = `Pregunta ${q.id}`
    const idX = IX + pw + 6
    display(idText, idX, rowCenter, { size: TYPE.body.size, color: C.ink, baseline: 'middle' })

    const answerText = `Tu respuesta: ${selected.length ? selected.join(', ') : '-'}`
    const answerW = textWidth(answerText, 'bold', TYPE.small.size)
    const topic = topicLabel(q.topic)
    const topicX = idX + textWidth(idText, 'bold', TYPE.body.size, DISPLAY) + 7
    if (topicX + textWidth(topic, 'normal', TYPE.small.size) + 8 + answerW <= IR) {
      txt(topic, topicX, rowCenter, { size: TYPE.small.size, color: C.muted, baseline: 'middle' })
    }
    txt(answerText, IR, rowCenter, {
      style: 'bold',
      size: TYPE.small.size,
      color: tone.dark,
      align: 'right',
      baseline: 'middle',
    })

    setDraw(C.line)
    doc.setLineWidth(0.3)
    doc.line(IX, cy + 10.5, IR, cy + 10.5)
  }

  /** One statement line, positioned like a single line of linesBlock. */
  const drawStatementLine = (line, cy) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(TYPE.body.size)
    setColor(C.ink)
    doc.text(line, IX, cy + TYPE.body.size * MM_PT * 0.76)
  }

  const drawOption = ({ kind, h: rowH, letter, style, lines, step }, cy) => {
    if (kind !== 'neutral') {
      setFill(OPTION_TINT[kind])
      rrect(TINT_X, cy, TINT_W, rowH, RADIUS.control, 'F')
    }

    const badge = OPTION_BADGE[kind]
    const bh = 6.5
    const by = cy + (rowH - bh) / 2
    setFill(badge)
    rrect(IX, by, bh, bh, RADIUS.control, 'F')
    display(letter, IX + bh / 2, by + bh / 2, {
      size: TYPE.caption.size,
      color: C.white,
      align: 'center',
      baseline: 'middle',
    })

    const color = OPTION_TEXT[kind]
    // linesBlock anchors the alphabetic baseline, which leaves the em box
    // above the line-box centre; nudge by half a leading so the glyphs sit
    // on the badge centre instead of a millimetre above it.
    const em = TYPE.body.size * MM_PT
    const textTop = cy + (rowH - lines.length * step) / 2 + (step - em) / 2
    linesBlock(lines, IX + 10.5, textTop, TYPE.body.size, style, color, step)
  }

  const drawCorrect = (result, tone, cy) => {
    setFill(tone.accent)
    rrect(IX, cy + 0.8, 3.6, 3.6, 0.6, 'F')
    txt(`Respuesta correcta: ${result.question.answer.join(', ')}`, IX + 5.6, cy + 4, {
      style: 'bold',
      size: TYPE.small.size,
      color: tone.dark,
    })
  }

  const drawHint = (lines, step, cy) => {
    const boxH = lines.length * step + 6
    setFill(C.amberWash)
    setDraw(C.amberLine)
    doc.setLineWidth(0.3)
    rrect(TINT_X, cy, TINT_W, boxH, RADIUS.control, 'FD')
    setFill(C.amber)
    doc.rect(TINT_X, cy, 1.2, boxH, 'F')
    // Vertically centred inside the box, equal padding above and below.
    linesBlock(lines, TINT_X + 5, cy + (boxH - lines.length * step) / 2, TYPE.quote.size, TYPE.quote.style, C.slate, step)
  }

  /**
   * Questions flow to the bottom of the page and continue on the next one
   * (with a "continúa" strip) instead of jumping whole and leaving a large
   * blank area. The header + statement are the only unsplittable unit.
   */
  const drawBlock = (result) => {
    const { tone, elements: els } = layoutQuestion(result)
    const q = result.question

    const segs = []
    let segTop = y
    let segPage = pageNo
    let from = 0
    let cursor = segTop + BLOCK.padT
    let i = 0
    let freshPage = false

    while (i < els.length) {
      if (cursor + els[i].h + BLOCK.padB <= BOTTOM) {
        cursor += els[i].h
        i += 1
        freshPage = false
        continue
      }
      if (i === from && !freshPage) {
        // Nothing drawn in this segment yet: retry on a clean page.
        newPage()
        segTop = y
        segPage = pageNo
        cursor = y + BLOCK.padT
        freshPage = true
        continue
      }
      if (i === from) {
        // An element taller than the page body: draw it and accept overflow.
        cursor += els[i].h
        i += 1
        continue
      }
      // Never strand a single trailing element (the hint box) alone on the
      // next page: move the previous element with it when possible.
      let end = i
      let segCursor = cursor
      if (els.length - i === 1 && i - 1 > from) {
        end = i - 1
        segCursor = cursor - els[end].h
      }
      segs.push({ top: segTop, bottom: segCursor + BLOCK.padB, page: segPage, from, to: end, cont: from > 0 })
      newPage()
      segTop = y
      segPage = pageNo
      from = end
      i = end
      cursor = y + BLOCK.padT + 7
      freshPage = true
    }
    segs.push({ top: segTop, bottom: cursor + BLOCK.padB, page: segPage, from, to: els.length, cont: from > 0 })
    y = cursor + BLOCK.padB

    const back = pageNo
    segs.forEach((seg) => {
      doc.setPage(seg.page)
      setFill(tone.wash)
      rrect(X0, seg.top, CONTENT_W, seg.bottom - seg.top, RADIUS.panel, 'F')
      setDraw(tone.line)
      doc.setLineWidth(0.35)
      rrect(X0, seg.top, CONTENT_W, seg.bottom - seg.top, RADIUS.panel, 'S')
      setFill(tone.accent)
      // Thin status rule, inset so the card's rounded corners stay clean.
      doc.rect(X1 - 1.8, seg.top + 1.6, BLOCK.rule, seg.bottom - seg.top - 3.2, 'F')

      let cy = seg.top + BLOCK.padT
      if (seg.cont) {
        txt(`Pregunta ${q.id} · continúa`, IX, seg.top + BLOCK.padT + 3.2, {
          size: TYPE.caption.size,
          color: tone.dark,
          baseline: 'middle',
        })
        setDraw(tone.line)
        doc.setLineWidth(0.3)
        doc.line(IX, seg.top + BLOCK.padT + 7, IR, seg.top + BLOCK.padT + 7)
        cy = seg.top + BLOCK.padT + 7
      }
      for (let k = seg.from; k < seg.to; k++) {
        els[k].draw(cy)
        cy += els[k].h
      }
    })
    doc.setPage(back)
  }

  // --- footer ------------------------------------------------------------
  const footers = () => {
    const total = doc.getNumberOfPages()
    for (let p = 1; p <= total; p++) {
      doc.setPage(p)
      setFill(C.amber)
      doc.rect(X0, FOOT_Y - 0.35, 16, 0.7, 'F')
      setDraw(C.line)
      doc.setLineWidth(0.3)
      doc.line(X0 + 16, FOOT_Y, X1, FOOT_Y)
      txt(
        'Catálogo IHF - Test reglas de juego · Catálogo de preguntas IHF (ES) + Resolución de preguntas (EN), jul 2025',
        X0,
        FOOT_Y + 4.4,
        { size: TYPE.caption.size, color: C.muted },
      )
      txt('Test no oficial · Herramienta de estudio independiente no vinculada a la IHF.', X0, FOOT_Y + 8.4, {
        size: TYPE.caption.size,
        color: C.muted,
      })
      txt(`Página ${p} de ${total}`, X1, FOOT_Y + 4.4, {
        style: 'bold',
        size: TYPE.caption.size,
        color: C.slate,
        align: 'right',
      })
      txt('catalogoihf.netlify.app', X1, FOOT_Y + 8.4, {
        size: TYPE.caption.size,
        color: C.muted,
        align: 'right',
      })
    }
  }

  // --- document ----------------------------------------------------------
  header(true)
  summaryCard()
  legend()

  const groups = { accepted: [], partial: [], failed: [] }
  report.results.forEach((r) => {
    const status = statusOf(r)
    if (status === 'accepted') groups.accepted.push(r)
    else if (status === 'partial') groups.partial.push(r)
    else groups.failed.push(r)
  })

  if (groups.accepted.length) {
    sectionTitle('Preguntas aceptadas', groups.accepted.length, STATUS.accepted)
    groups.accepted.forEach((r) => {
      drawBlock(r)
      y += BLOCK_GAP
    })
  }
  if (groups.partial.length) {
    sectionTitle('Preguntas parciales', groups.partial.length, STATUS.partial)
    groups.partial.forEach((r) => {
      drawBlock(r)
      y += BLOCK_GAP
    })
  }
  if (groups.failed.length) {
    sectionTitle('Preguntas falladas', groups.failed.length, STATUS.failed)
    groups.failed.forEach((r) => {
      drawBlock(r)
      y += BLOCK_GAP
    })
  }

  footers()

  const stamp = new Date().toISOString().slice(0, 10)
  const filename = filenameFor(report, stamp)
  doc.save(filename)
  return filename
}
