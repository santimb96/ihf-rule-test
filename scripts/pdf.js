/**
 * Styled PDF report built with jsPDF: cover header band, score summary card,
 * section titles and question blocks framed by a green/red side rule, all laid
 * out on a fixed margin grid with a small type scale and a baseline rhythm.
 */
(function (global) {
  "use strict";

  var D = global.IHFData;

  // --- page grid (mm) ----------------------------------------------------
  var PAGE = { w: 210, h: 297 };
  var X0 = 15; // outer left margin
  var X1 = PAGE.w - 15; // outer right margin
  var CONTENT_W = X1 - X0; // 180

  var FOOT_Y = 284; // footer rule
  var BOTTOM = 279; // content must stop above the footer
  var BAND1 = 36; // cover header band
  var BANDN = 16; // running header band
  var BAND_ACCENT = 1.6; // amber rule under every band
  var START1 = BAND1 + BAND_ACCENT + 8.4; // 46
  var STARTN = BANDN + BAND_ACCENT + 6.4; // 24

  var SP = { s: 3.5, m: 5, l: 8 }; // vertical rhythm between blocks
  var BLOCK_GAP = 6; // gap between two question blocks

  var MM_PT = 25.4 / 72;
  function lh(size, mult) {
    return size * (mult || 1.4) * MM_PT;
  }

  // --- type scale --------------------------------------------------------
  var TYPE = {
    display: { size: 24, style: "bold" },
    title: { size: 19, style: "bold" },
    h1: { size: 13, style: "bold" },
    h2: { size: 10.5, style: "bold" },
    body: { size: 9.5, style: "normal" },
    small: { size: 8.5, style: "normal" },
    quote: { size: 8, style: "italic" },
    caption: { size: 7.5, style: "normal" },
  };

  // --- palette -----------------------------------------------------------
  var C = {
    navy: [17, 34, 77],
    navySoft: [168, 188, 236],
    amber: [245, 158, 11],
    green: [16, 140, 97],
    greenDark: [6, 95, 70],
    greenTint: [231, 247, 240],
    greenWash: [246, 252, 249],
    greenLine: [211, 233, 223],
    red: [203, 48, 63],
    redDark: [153, 27, 27],
    redTint: [253, 236, 237],
    redWash: [254, 248, 248],
    redLine: [244, 218, 220],
    ink: [15, 23, 42],
    slate: [71, 85, 105],
    muted: [100, 116, 139],
    line: [226, 232, 240],
    card: [236, 241, 246],
    badge: [148, 163, 184],
    white: [255, 255, 255],
  };

  /** Status tone used by the section title and by each question block. */
  function toneFor(correct) {
    return correct
      ? {
          accent: C.green,
          dark: C.greenDark,
          tint: C.greenTint,
          wash: C.greenWash,
          line: C.greenLine,
          pill: C.green,
        }
      : {
          accent: C.red,
          dark: C.redDark,
          tint: C.redTint,
          wash: C.redWash,
          line: C.redLine,
          pill: C.red,
        };
  }

  // jsPDF standard fonts only cover Latin-1, so normalise typographic glyphs.
  function sanitize(text) {
    return String(text)
      .replace(/[“”„]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—−]/g, "-")
      .replace(/…/g, "...")
      .replace(/≥/g, ">=")
      .replace(/≤/g, "<=")
      .replace(/≠/g, "!=")
      .replace(/[×✕]/g, "x")
      .replace(/→/g, "->")
      .replace(/′/g, "'")
      .replace(/″/g, '"')
      .replace(/•/g, "-")
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
  }

  function generate(report, config) {
    var jsPDF = global.jspdf && global.jspdf.jsPDF;
    if (!jsPDF) {
      global.IHFRender.toast("No se pudo cargar la librería PDF. Revisa tu conexión.");
      return null;
    }

    var doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    var y = 0;
    var pageNo = 1;

    // --- drawing primitives ---------------------------------------------
    function setColor(rgb) {
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    }

    function setFill(rgb) {
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    }

    function setDraw(rgb) {
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    }

    // jsPDF 2.5.x exposes roundedRect(x, y, w, h, rx, ry, style).
    function rrect(x, yy, w, h, r, style) {
      doc.roundedRect(x, yy, w, h, r, r, style);
    }

    function txt(str, x, yy, o) {
      o = o || {};
      doc.setFont("helvetica", o.style || "normal");
      doc.setFontSize(o.size || TYPE.body.size);
      setColor(o.color || C.ink);
      doc.text(sanitize(str), x, yy, {
        align: o.align || "left",
        baseline: o.baseline || "alphabetic",
        charSpace: o.charSpace || 0,
      });
    }

    function wrap(str, style, size, width) {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      return doc.splitTextToSize(sanitize(str), width);
    }

    function textWidth(str, style, size) {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      return doc.getTextWidth(sanitize(str));
    }

    /** Draws pre-wrapped lines from a block top and returns the block height. */
    function linesBlock(lines, x, yTop, size, style, color, step) {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      setColor(color);
      lines.forEach(function (line, i) {
        doc.text(line, x, yTop + size * MM_PT * 0.76 + i * step);
      });
      return lines.length * step;
    }

    function paragraphHeight(lines, size) {
      return lines.length * lh(size, 1.4);
    }

    // --- header bands ----------------------------------------------------
    function header(first) {
      var band = first ? BAND1 : BANDN;
      setFill(C.white);
      doc.rect(0, 0, PAGE.w, PAGE.h, "F");
      setFill(C.navy);
      doc.rect(0, 0, PAGE.w, band, "F");
      setFill(C.amber);
      doc.rect(0, band, PAGE.w, BAND_ACCENT, "F");

      if (first) {
        setFill(C.amber);
        rrect(X0, 9.5, 15, 15, 2.5, "F");
        txt("IHF", X0 + 7.5, 17.4, {
          style: "bold",
          size: 11,
          color: C.navy,
          align: "center",
          baseline: "middle",
        });

        txt("INFORME DE RESULTADOS", X0 + 21, 11.5, {
          style: "bold",
          size: TYPE.caption.size,
          color: C.amber,
          charSpace: 1.2,
        });
        txt("IHF RULES TRAINER", X0 + 21, 21, {
          style: "bold",
          size: TYPE.title.size,
          color: C.white,
          charSpace: 0.5,
        });
        txt("Informe del test de Reglas de Juego - Catálogo oficial IHF (jul 2025)", X0 + 21, 28.5, {
          size: TYPE.small.size,
          color: C.navySoft,
        });

        txt(
          new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }),
          X1,
          16,
          { size: TYPE.small.size, color: C.navySoft, align: "right" },
        );
        txt("Aprobado >= 75%", X1, 24.5, {
          style: "bold",
          size: TYPE.small.size,
          color: C.amber,
          align: "right",
        });
      } else {
        txt("IHF RULES TRAINER", X0, 10.5, {
          style: "bold",
          size: TYPE.body.size,
          color: C.white,
          charSpace: 0.4,
        });
        txt("Test de Reglas de Juego - Informe de resultados", X1, 10.5, {
          size: TYPE.caption.size,
          color: C.navySoft,
          align: "right",
        });
      }
      y = first ? START1 : STARTN;
    }

    function newPage() {
      doc.addPage();
      pageNo += 1;
      header(false);
    }

    function ensureSpace(h) {
      if (y + h > BOTTOM) newPage();
    }

    // --- summary card ----------------------------------------------------
    function summaryCard() {
      var topicsText =
        config.topics.length === D.topics().length
          ? "Todos los temas"
          : config.topics
              .map(function (id) {
                return D.topicLabel(id);
              })
              .join(", ");

      var barW = 4;
      var colX = X0 + barW + 8; // 27, score column
      var divX = X0 + 66; // 81, vertical divider
      var rightX = divX + 8; // 89, details column
      var rightW = X1 - 8 - rightX; // 98

      var topicLines = wrap("Temas: " + topicsText, "normal", TYPE.caption.size, rightW);
      var topicsH = paragraphHeight(topicLines, TYPE.caption.size);
      var leftH = 45;
      var cardH = Math.max(leftH, 22.5 + topicsH + 6);

      setFill(C.white);
      setDraw(C.line);
      doc.setLineWidth(0.35);
      doc.rect(X0, y, CONTENT_W, cardH, "FD");

      setFill(report.passed ? C.green : C.red);
      doc.rect(X0, y, barW, cardH, "F");

      setDraw(C.line);
      doc.setLineWidth(0.3);
      doc.line(divX, y + 6, divX, y + cardH - 6);

      // Left column: status pill, score, percentage.
      var pillText = report.passed ? "APROBADO" : "NO APROBADO";
      var pw = textWidth(pillText, "bold", TYPE.small.size) + 9;
      setFill(report.passed ? C.green : C.red);
      rrect(colX, y + 6, pw, 8, 4, "F");
      txt(pillText, colX + pw / 2, y + 10.2, {
        style: "bold",
        size: TYPE.small.size,
        color: C.white,
        align: "center",
        baseline: "middle",
      });

      var score = report.score + "/" + report.totalAnswers;
      txt(score, colX, y + 31, {
        style: "bold",
        size: TYPE.display.size,
        color: report.passed ? C.green : C.red,
      });
      txt(report.percentage + "% de respuestas", colX, y + 38.5, {
        size: TYPE.body.size,
        color: C.slate,
      });

      // Right column: test details and topics.
      txt("Test de Reglas de Juego", rightX, y + 12, {
        style: "bold",
        size: TYPE.h2.size,
        color: C.navy,
      });
      txt(
        report.total + " preguntas  |  Mínimo para aprobar: " + report.required + " respuestas (75%)",
        rightX,
        y + 18.5,
        { size: TYPE.small.size, color: C.slate },
      );
      linesBlock(
        topicLines,
        rightX,
        y + 22.5,
        TYPE.caption.size,
        "normal",
        C.muted,
        lh(TYPE.caption.size, 1.4),
      );

      y += cardH + SP.l;
    }

    function legend() {
      var top = y;
      var items = [
        { c: C.green, label: "Respuesta correcta" },
        { c: C.red, label: "Selección incorrecta" },
        { c: C.badge, label: "Sin marcar" },
      ];
      var x = X0;
      items.forEach(function (it) {
        setFill(it.c);
        rrect(x, top + 1, 3.6, 3.6, 0.9, "F");
        txt(it.label, x + 5.2, top + 4.4, { size: TYPE.caption.size, color: C.slate });
        x += 5.2 + textWidth(it.label, "normal", TYPE.caption.size) + 12;
      });

      var note =
        "Cada bloque cita las directrices del catálogo y lleva en el margen derecho una barra " +
        "de estado: verde si la pregunta se aceptó, rojo si se falló.";
      var lines = wrap(note, "normal", TYPE.caption.size, CONTENT_W);
      var h = linesBlock(lines, X0, top + 9, TYPE.caption.size, "normal", C.muted, lh(TYPE.caption.size, 1.45));
      y = top + 9 + h + SP.l;
    }

    // --- section title ---------------------------------------------------
    function sectionTitle(label, count, tone) {
      ensureSpace(50);
      var top = y;
      txt(label, X0, top + 10, { style: "bold", size: TYPE.h1.size, color: tone.accent });
      var labelW = textWidth(label, "bold", TYPE.h1.size);

      var countText = String(count);
      var pillW = textWidth(countText, "bold", TYPE.small.size) + 8;
      setFill(tone.tint);
      rrect(X0 + labelW + 6, top + 3, pillW, 8, 4, "F");
      txt(countText, X0 + labelW + 6 + pillW / 2, top + 7.2, {
        style: "bold",
        size: TYPE.small.size,
        color: tone.dark,
        align: "center",
        baseline: "middle",
      });

      // Accent segment + hairline, the same motif as the footer rule.
      setFill(tone.accent);
      doc.rect(X0, top + 14.6, 30, 0.9, "F");
      setDraw(C.line);
      doc.setLineWidth(0.3);
      doc.line(X0 + 30, top + 15.05, X1, top + 15.05);

      y = top + 15.05 + SP.l;
    }

    // --- question blocks -------------------------------------------------
    var BLOCK = { padT: 5, padB: 6, rule: 3 };
    var IX = X0 + 6; // 21, inner text left
    var IR = X1 - 8; // 187, inner text right
    var IW = IR - IX; // 166
    var TINT_X = IX - 3; // 18, option tint band
    var TINT_W = IR + 3 - TINT_X; // 172

    function layoutQuestion(result) {
      var q = result.question;
      var chips = D.chips(q);
      var chipText = chips
        .map(function (c) {
          return c.label;
        })
        .join("  |  ");
      var tone = toneFor(result.correct);
      var pillText = result.correct ? "ACEPTADA" : result.selected.length ? "FALLADA" : "SIN RESPONDER";

      var stmtStep = lh(TYPE.body.size, 1.4);
      var stmtLines = wrap(q.text, "bold", TYPE.body.size, IW);
      var stmtH = stmtLines.length * stmtStep + SP.s;

      var optRows = q.options.map(function (o) {
        var kind = q.answer.includes(o.letter)
          ? "correct"
          : result.selected.includes(o.letter)
            ? "wrong"
            : "neutral";
        var style = kind === "neutral" ? "normal" : "bold";
        var step = lh(TYPE.body.size, 1.4);
        var lines = wrap(o.text, style, TYPE.body.size, IW - 10.5);
        return {
          letter: o.letter,
          kind: kind,
          style: style,
          lines: lines,
          step: step,
          h: Math.max(8.5, lines.length * step + 4),
        };
      });

      var hintStep = lh(TYPE.quote.size, 1.42);
      var hintLines = wrap(
        "Directrices: " + (chipText || q.rules),
        TYPE.quote.style,
        TYPE.quote.size,
        163,
      );
      var hintH = hintLines.length * hintStep + 7;

      // Header row and statement are one element: they can never split apart.
      var elements = [
        {
          h: 12 + stmtH,
          draw: function (cy) {
            drawHeadStatement(result, tone, pillText, stmtLines, stmtStep, cy);
          },
        },
      ];
      optRows.forEach(function (row) {
        elements.push({
          h: row.h,
          draw: function (cy) {
            drawOption(row, cy);
          },
        });
      });
      elements.push({
        h: SP.m + 5.5,
        draw: function (cy) {
          drawCorrect(result, tone, cy + SP.m);
        },
      });
      elements.push({
        h: SP.s + hintH,
        draw: function (cy) {
          drawHint(hintLines, hintStep, cy + SP.s);
        },
      });

      var total = elements.reduce(function (sum, el) {
        return sum + el.h;
      }, 0);

      return { tone: tone, elements: elements, total: total };
    }

    function drawHeadStatement(result, tone, pillText, stmtLines, stmtStep, cy) {
      var q = result.question;

      var pw = textWidth(pillText, "bold", TYPE.caption.size) + 8;
      setFill(tone.pill);
      rrect(IX, cy, pw, 6.5, 3.25, "F");
      txt(pillText, IX + pw / 2, cy + 3.4, {
        style: "bold",
        size: TYPE.caption.size,
        color: C.white,
        align: "center",
        baseline: "middle",
      });

      var idText = "Pregunta " + q.id;
      var idX = IX + pw + 6;
      txt(idText, idX, cy + 4.7, { style: "bold", size: TYPE.body.size, color: C.ink });

      var answerText = "Tu respuesta: " + (result.selected.length ? result.selected.join(", ") : "-");
      var answerW = textWidth(answerText, "bold", TYPE.small.size);
      var topic = D.topicLabel(q.topic);
      var topicX = idX + textWidth(idText, "bold", TYPE.body.size) + 7;
      if (topicX + textWidth(topic, "normal", TYPE.small.size) + 8 + answerW <= IR) {
        txt(topic, topicX, cy + 4.7, { size: TYPE.small.size, color: C.muted });
      }
      txt(answerText, IR, cy + 4.7, {
        style: "bold",
        size: TYPE.small.size,
        color: tone.dark,
        align: "right",
      });

      setDraw(C.line);
      doc.setLineWidth(0.3);
      doc.line(IX, cy + 10.5, IR, cy + 10.5);

      linesBlock(stmtLines, IX, cy + 12, TYPE.body.size, "bold", C.ink, stmtStep);
    }

    function drawOption(row, cy) {
      if (row.kind !== "neutral") {
        setFill(row.kind === "correct" ? C.greenTint : C.redTint);
        doc.rect(TINT_X, cy, TINT_W, row.h, "F");
      }

      var badge = row.kind === "correct" ? C.green : row.kind === "wrong" ? C.red : C.badge;
      var bh = 6.5;
      var by = cy + (row.h - bh) / 2;
      setFill(badge);
      rrect(IX, by, bh, bh, 1.6, "F");
      txt(row.letter, IX + bh / 2, by + bh / 2, {
        style: "bold",
        size: TYPE.caption.size,
        color: C.white,
        align: "center",
        baseline: "middle",
      });

      var color = row.kind === "correct" ? C.greenDark : row.kind === "wrong" ? C.redDark : C.slate;
      // linesBlock anchors the alphabetic baseline, which leaves the em box
      // above the line-box centre; nudge by half a leading so the glyphs sit
      // on the badge centre instead of a millimetre above it.
      var em = TYPE.body.size * MM_PT;
      var textTop = cy + (row.h - row.lines.length * row.step) / 2 + (row.step - em) / 2;
      linesBlock(row.lines, IX + 10.5, textTop, TYPE.body.size, row.style, color, row.step);
    }

    function drawCorrect(result, tone, cy) {
      setFill(tone.accent);
      rrect(IX, cy + 0.8, 3.6, 3.6, 0.9, "F");
      txt("Respuesta correcta: " + result.question.answer.join(", "), IX + 5.6, cy + 4, {
        style: "bold",
        size: TYPE.small.size,
        color: tone.dark,
      });
    }

    function drawHint(lines, step, cy) {
      var boxH = lines.length * step + 7;
      setFill(C.card);
      doc.rect(TINT_X, cy, TINT_W, boxH, "F");
      setFill(C.badge);
      doc.rect(TINT_X, cy, 1.2, boxH, "F");
      linesBlock(lines, TINT_X + 5.5, cy + 3.5, TYPE.quote.size, TYPE.quote.style, C.slate, step);
    }

    /**
     * Measures a block, moves it as a whole when it fits on a fresh page and
     * only then splits it, drawing the frame once per page segment.
     */
    function drawBlock(result) {
      var layout = layoutQuestion(result);
      var tone = layout.tone;
      var blockH = BLOCK.padT + layout.total + BLOCK.padB;

      if (blockH <= BOTTOM - STARTN && y + blockH > BOTTOM) newPage();
      if (y + BLOCK.padT + BLOCK.padB > BOTTOM) newPage();

      var segs = [];
      var segTop = y;
      var segPage = pageNo;
      var from = 0;
      var cursor = y + BLOCK.padT;

      for (var i = 0; i < layout.elements.length; i++) {
        var el = layout.elements[i];
        if (cursor + el.h + BLOCK.padB > BOTTOM) {
          segs.push({ top: segTop, bottom: cursor + BLOCK.padB, page: segPage, from: from, to: i });
          newPage();
          segTop = y;
          segPage = pageNo;
          cursor = y + BLOCK.padT;
          from = i;
        }
        cursor += el.h;
      }
      segs.push({ top: segTop, bottom: cursor + BLOCK.padB, page: segPage, from: from, to: layout.elements.length });
      y = cursor + BLOCK.padB;

      var back = pageNo;
      segs.forEach(function (seg) {
        doc.setPage(seg.page);
        setFill(tone.wash);
        doc.rect(X0, seg.top, CONTENT_W, seg.bottom - seg.top, "F");
        setDraw(tone.line);
        doc.setLineWidth(0.35);
        doc.rect(X0, seg.top, CONTENT_W, seg.bottom - seg.top, "S");
        setFill(tone.accent);
        doc.rect(X1 - BLOCK.rule, seg.top, BLOCK.rule, seg.bottom - seg.top, "F");

        var cy = seg.top + BLOCK.padT;
        for (var i = seg.from; i < seg.to; i++) {
          layout.elements[i].draw(cy);
          cy += layout.elements[i].h;
        }
      });
      doc.setPage(back);
    }

    // --- footer ----------------------------------------------------------
    function footers() {
      var total = doc.getNumberOfPages();
      for (var p = 1; p <= total; p++) {
        doc.setPage(p);
        setFill(C.amber);
        doc.rect(X0, FOOT_Y - 0.35, 16, 0.7, "F");
        setDraw(C.line);
        doc.setLineWidth(0.3);
        doc.line(X0 + 16, FOOT_Y, X1, FOOT_Y);
        txt(
          "IHF Rules Trainer - Catálogo de preguntas IHF (ES) + Answer key (EN), jul 2025",
          X0,
          FOOT_Y + 5.5,
          { size: TYPE.caption.size, color: C.muted },
        );
        txt("Página " + p + " de " + total, X1, FOOT_Y + 5.5, {
          style: "bold",
          size: TYPE.caption.size,
          color: C.slate,
          align: "right",
        });
      }
    }

    // --- document --------------------------------------------------------
    header(true);
    summaryCard();
    legend();

    var accepted = report.results.filter(function (r) {
      return r.correct;
    });
    var failed = report.results.filter(function (r) {
      return !r.correct;
    });

    if (accepted.length) {
      sectionTitle("Preguntas aceptadas", accepted.length, toneFor(true));
      accepted.forEach(function (r) {
        drawBlock(r);
        y += BLOCK_GAP;
      });
    }
    if (failed.length) {
      sectionTitle("Preguntas falladas", failed.length, toneFor(false));
      failed.forEach(function (r) {
        drawBlock(r);
        y += BLOCK_GAP;
      });
    }

    footers();

    var stamp = new Date().toISOString().slice(0, 10);
    var filename = "ihf-test-" + report.correct + "-" + report.total + "-" + stamp + ".pdf";
    doc.save(filename);
    return filename;
  }

  global.IHFPdf = { generate: generate, sanitize: sanitize };
})(globalThis);
