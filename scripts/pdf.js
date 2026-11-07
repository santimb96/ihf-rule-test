/**
 * Styled PDF report built with jsPDF and aligned with the on-screen design
 * system: brand navy band with handball-court line art, Archivo for display
 * text (same face as the web headings), a score ring, status pills with the
 * same four review states as the results screen, and a fixed margin grid.
 */
(function (global) {
  "use strict";

  var D = global.IHFData;

  // --- page grid (mm) ----------------------------------------------------
  var PAGE = { w: 210, h: 297 };
  var X0 = 15; // outer left margin
  var X1 = PAGE.w - 15; // outer right margin
  var CONTENT_W = X1 - X0; // 180

  var FOOT_Y = 282; // footer rule
  var BOTTOM = 276; // content must stop above the footer
  var BAND1 = 38; // cover header band
  var BANDN = 16; // running header band
  var BAND_ACCENT = 1.4; // amber rule under every band
  var START1 = BAND1 + BAND_ACCENT + 8; // 47.4
  var STARTN = BANDN + BAND_ACCENT + 6; // 23.4

  var SP = { s: 3.5, m: 5, l: 8 }; // vertical rhythm between blocks
  var BLOCK_GAP = 5; // gap between two question blocks
  var RADIUS = { panel: 1.6, control: 1.0 }; // 6px / 4px at web scale

  var MM_PT = 25.4 / 72;
  function lh(size, mult) {
    return size * (mult || 1.4) * MM_PT;
  }

  // --- type scale --------------------------------------------------------
  var TYPE = {
    display: { size: 25, style: "bold" },
    title: { size: 18.5, style: "bold" },
    h1: { size: 13, style: "bold" },
    h2: { size: 10.5, style: "bold" },
    body: { size: 9.5, style: "normal" },
    small: { size: 8.5, style: "normal" },
    quote: { size: 8, style: "italic" },
    caption: { size: 7.5, style: "normal" },
  };

  // --- palette: the web's brand tokens ----------------------------------
  var C = {
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
  };

  /**
   * The four review states of the results screen, replicated exactly:
   * accepted (all correct options picked, no wrong one), partial (a correct
   * subset without mistakes), failed (a wrong option was picked) and
   * unanswered (nothing selected).
   */
  function statusOf(result) {
    var answer = (result.question && result.question.answer) || [];
    var selected = result.selected || [];
    if (result.correct) return "accepted";
    if (!selected.length) return "unanswered";
    for (var i = 0; i < selected.length; i++) {
      if (answer.indexOf(selected[i]) === -1) return "failed";
    }
    return "partial";
  }

  var STATUS = {
    accepted: { label: "ACERTADA", accent: C.green, dark: C.greenDark, tint: C.greenTint, wash: C.greenWash, line: C.greenLine },
    partial: { label: "PARCIAL", accent: C.amber, dark: C.amberDark, tint: C.amberTint, wash: C.amberWash, line: C.amberLine },
    failed: { label: "FALLADA", accent: C.rose, dark: C.roseDark, tint: C.roseTint, wash: C.roseWash, line: C.roseLine },
    unanswered: { label: "SIN RESPONDER", accent: C.badge, dark: C.slate, tint: C.slateTint, wash: C.slateWash, line: C.line },
  };

  var STATUS_LABELS = {
    accepted: STATUS.accepted.label,
    partial: STATUS.partial.label,
    failed: STATUS.failed.label,
    unanswered: STATUS.unanswered.label,
  };

  /** The file name repeats the answer score shown in the summary card. */
  function filenameFor(report, stamp) {
    return "ihf-test-" + report.score + "-de-" + report.totalAnswers + "-" + stamp + ".pdf";
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

  // --- assets ------------------------------------------------------------
  function toBase64(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  async function loadAsset(url) {
    var res = await fetch(url);
    if (!res.ok) throw new Error(url + " -> " + res.status);
    return new Uint8Array(await res.arrayBuffer());
  }

  async function generate(report, config) {
    var jsPDF = global.jspdf && global.jspdf.jsPDF;
    if (!jsPDF) {
      global.IHFRender.toast("No se pudo cargar la librería PDF. Revisa tu conexión.");
      return null;
    }

    // The display face and the logo are optional: without them the report
    // falls back to Helvetica and the amber "R" tile, never to a broken PDF.
    var fontB64 = null;
    var logoData = null;
    try {
      fontB64 = toBase64(await loadAsset("assets/fonts/archivo-bold.ttf"));
    } catch (err) {
      fontB64 = null;
    }
    try {
      logoData = "data:image/png;base64," + toBase64(await loadAsset("assets/logo-handball-white.png"));
    } catch (err) {
      logoData = null;
    }

    var doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    var DISPLAY = "helvetica";
    if (fontB64) {
      try {
        doc.addFileToVFS("Archivo-Bold.ttf", fontB64);
        doc.addFont("Archivo-Bold.ttf", "Archivo", "bold");
        DISPLAY = "Archivo";
      } catch (err) {
        DISPLAY = "helvetica";
      }
    }

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

    function rrect(x, yy, w, h, r, style) {
      doc.roundedRect(x, yy, w, h, r, r, style);
    }

    function txt(str, x, yy, o) {
      o = o || {};
      doc.setFont(o.family || "helvetica", o.style || "normal");
      doc.setFontSize(o.size || TYPE.body.size);
      setColor(o.color || C.ink);
      doc.text(sanitize(str), x, yy, {
        align: o.align || "left",
        baseline: o.baseline || "alphabetic",
        charSpace: o.charSpace || 0,
      });
    }

    /** Display text: Archivo when embedded, bold Helvetica otherwise. */
    function display(str, x, yy, o) {
      o = o || {};
      txt(str, x, yy, {
        family: DISPLAY,
        style: "bold",
        size: o.size || TYPE.h1.size,
        color: o.color || C.ink,
        align: o.align,
        baseline: o.baseline,
        charSpace: o.charSpace,
      });
    }

    function wrap(str, style, size, width, family) {
      doc.setFont(family || "helvetica", style);
      doc.setFontSize(size);
      return doc.splitTextToSize(sanitize(str), width);
    }

    function textWidth(str, style, size, family) {
      doc.setFont(family || "helvetica", style);
      doc.setFontSize(size);
      return doc.getTextWidth(sanitize(str));
    }

    // Equal left/right padding inside every pill, charSpace included.
    var PILL_PAD = 5.5;
    function pillWidth(str, style, size, family, charSpace) {
      var w = textWidth(str, style, size, family);
      if (charSpace) w += charSpace * Math.max(0, String(str).length - 1);
      return w + PILL_PAD * 2;
    }

    /** Draws pre-wrapped lines from a block top and returns the block height. */
    function linesBlock(lines, x, yTop, size, style, color, step, family) {
      doc.setFont(family || "helvetica", style);
      doc.setFontSize(size);
      setColor(color);
      lines.forEach(function (line, i) {
        doc.text(line, x, yTop + size * MM_PT * 0.76 + i * step);
      });
      return lines.length * step;
    }

    // --- handball court line art, bleeding off the page like the web hero --
    function courtFull(x, yTop, w) {
      var u = w / 400; // 400 x 200 court units
      function px(v) {
        return x + v * u;
      }
      function py(v) {
        return yTop + v * u;
      }
      function strokeArc(cx, cy, r, a0, a1, steps) {
        var prevX = px(cx) + r * u * Math.cos(a0);
        var prevY = py(cy) + r * u * Math.sin(a0);
        for (var i = 1; i <= steps; i++) {
          var a = a0 + ((a1 - a0) * i) / steps;
          var nx = px(cx) + r * u * Math.cos(a);
          var ny = py(cy) + r * u * Math.sin(a);
          doc.line(prevX, prevY, nx, ny);
          prevX = nx;
          prevY = ny;
        }
      }

      doc.setLineWidth(0.45);
      setDraw(C.white);
      doc.setGState(new doc.GState({ opacity: 0.8 }));

      doc.rect(px(1.5), py(1.5), 397 * u, 197 * u, "S");
      doc.line(px(200), py(1.5), px(200), py(198.5));
      // Left goal area: goal line -> arc -> 3 m front line -> arc -> goal line.
      strokeArc(0, 85, 60, -Math.PI / 2, 0, 16);
      doc.line(px(60), py(85), px(60), py(115));
      strokeArc(0, 115, 60, 0, Math.PI / 2, 16);
      // Right goal area.
      strokeArc(400, 85, 60, -Math.PI / 2, -Math.PI, 16);
      doc.line(px(340), py(85), px(340), py(115));
      strokeArc(400, 115, 60, Math.PI, Math.PI / 2, 16);
      // Goals.
      doc.setLineWidth(1.3);
      doc.line(px(1.5), py(85), px(1.5), py(115));
      doc.line(px(398.5), py(85), px(398.5), py(115));

      doc.setGState(new doc.GState({ opacity: 1 }));
      return 200 * u;
    }

    // --- header bands ----------------------------------------------------
    function lerpColor(a, b, t) {
      return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
      ];
    }

    /** Stepped gradient that reads as the web hero (brand-950 -> 900 -> 700). */
    function paintBandGradient(h) {
      var steps = 72;
      for (var i = 0; i < steps; i++) {
        var t = i / (steps - 1);
        setFill(t < 0.5 ? lerpColor(C.brand950, C.brand900, t * 2) : lerpColor(C.brand900, C.brand700, (t - 0.5) * 2));
        doc.rect((PAGE.w / steps) * i, 0, PAGE.w / steps + 0.15, h, "F");
      }
    }

    function header(first) {
      var band = first ? BAND1 : BANDN;
      setFill(C.white);
      doc.rect(0, 0, PAGE.w, PAGE.h, "F");
      paintBandGradient(band);
      setFill(C.amber);
      doc.rect(0, band, PAGE.w, BAND_ACCENT, "F");

      if (first) {
        // Full court, larger than the band, cropped by the page edge.
        courtFull(126, -7, 104);

        if (logoData) {
          try {
            doc.addImage(logoData, "PNG", X0, 10.5, 15, 15);
          } catch (err) {
            logoData = null;
          }
        }
        if (!logoData) {
          setFill(C.amber);
          rrect(X0, 10.5, 15, 15, RADIUS.panel, "F");
          display("R", X0 + 7.5, 18.4, {
            size: 11,
            color: C.brand950,
            align: "center",
            baseline: "middle",
          });
        }

        display("INFORME DE RESULTADOS", X0 + 21, 12, {
          size: TYPE.caption.size,
          color: C.amber,
          charSpace: 1.2,
        });
        display("Catálogo IHF - Test reglas de juego", X0 + 21, 23, {
          size: TYPE.title.size,
          color: C.white,
          charSpace: 0.2,
        });
        txt("Test no oficial · Catálogo oficial IHF (jul 2025)", X0 + 21, 30.5, {
          size: TYPE.small.size,
          color: C.brand200,
        });
      } else {
        display("Catálogo IHF - Test reglas de juego", X0, 11, { size: TYPE.h2.size, color: C.white });
        txt("Test no oficial · Informe de resultados", X1, 11, {
          size: TYPE.caption.size,
          color: C.brand200,
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

    // --- score ring (mirrors the results ring) ---------------------------
    function ring(cx, cy, r, pct, color) {
      doc.setLineWidth(3.2);
      setDraw(C.line);
      doc.circle(cx, cy, r, "S");
      var p = Math.max(0, Math.min(100, pct));
      if (p > 0) {
        var steps = Math.max(4, Math.round((p / 100) * 120));
        var a0 = -Math.PI / 2;
        var a1 = a0 + (p / 100) * Math.PI * 2;
        setDraw(color);
        var prevX = cx + r * Math.cos(a0);
        var prevY = cy + r * Math.sin(a0);
        for (var i = 1; i <= steps; i++) {
          var a = a0 + ((a1 - a0) * i) / steps;
          var nx = cx + r * Math.cos(a);
          var ny = cy + r * Math.sin(a);
          doc.line(prevX, prevY, nx, ny);
          prevX = nx;
          prevY = ny;
        }
      }
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

      var innerX = X0 + 8 + 27 + 8; // card pad + ring diameter + gap
      var innerW = X1 - 8 - innerX;
      var pad = 8;
      var tone = report.passed ? STATUS.accepted : STATUS.failed;
      var headline = report.passed ? "¡Enhorabuena, has aprobado!" : "¡Esta vez no ha sido posible!";
      var sentence = report.passed
        ? "Has acertado " + report.score + " de " + report.totalAnswers + " respuestas (" + report.percentage + "%), por encima del 75% exigido."
        : "Has acertado " + report.score + " de " + report.totalAnswers + " respuestas (" + report.percentage + "%). Necesitabas " + report.required + " respuestas correctas para aprobar (75%).";
      var details =
        report.total +
        (report.total === 1 ? " pregunta" : " preguntas") +
        " · Mínimo para aprobar: " +
        report.required +
        (report.required === 1 ? " respuesta" : " respuestas") +
        " (75%)" +
        (report.elapsedTime !== undefined
          ? " · Tiempo: " + Math.floor(report.elapsedTime / 60) + "m " + (report.elapsedTime % 60) + "s"
          : "");

      var stmtStep = lh(TYPE.body.size, 1.4);
      var smallStep = lh(TYPE.small.size, 1.4);
      var capStep = lh(TYPE.caption.size, 1.4);
      var sLines = wrap(sentence, "normal", TYPE.body.size, innerW);
      var dLines = wrap(details, "normal", TYPE.small.size, innerW);
      var tLines = wrap("Temas: " + topicsText, "normal", TYPE.caption.size, innerW);
      var headlineH = lh(TYPE.h1.size, 1.2);
      var pillH = 8;
      var contentH =
        pillH + 3.2 + headlineH + 3.2 + sLines.length * stmtStep + 2 + dLines.length * smallStep + 1.5 + tLines.length * capStep;
      var cardH = Math.max(27 + pad * 2, contentH + pad * 2);

      setFill(C.white);
      setDraw(C.line);
      doc.setLineWidth(0.35);
      rrect(X0, y, CONTENT_W, cardH, RADIUS.panel, "FD");

      // Ring column.
      var cx = X0 + pad + 13.5;
      var cy = y + cardH / 2;
      ring(cx, cy, 13.5, report.percentage, tone.accent);
      display(report.percentage + "%", cx, cy - 1.4, {
        size: 14,
        color: C.ink,
        align: "center",
        baseline: "middle",
      });
      txt("respuestas", cx, cy + 5.4, {
        size: 6.2,
        color: C.muted,
        align: "center",
        baseline: "middle",
      });

      // Copy column.
      var top = y + pad;
      var pillText = report.passed ? "APROBADO" : "NO APROBADO";
      var pw = pillWidth(pillText, "bold", TYPE.small.size, DISPLAY, 0.4);
      setFill(tone.accent);
      rrect(innerX, top, pw, pillH, pillH / 2, "F");
      txt(pillText, innerX + pw / 2, top + pillH / 2, {
        family: DISPLAY,
        style: "bold",
        size: TYPE.small.size,
        color: C.white,
        align: "center",
        baseline: "middle",
        charSpace: 0.4,
      });

      var headlineBaseline = top + pillH + 4.6;
      display(headline, innerX, headlineBaseline, { size: TYPE.h1.size, color: C.ink });
      var cursor = headlineBaseline + 3.2;
      cursor += linesBlock(sLines, innerX, cursor, TYPE.body.size, "normal", C.slate, stmtStep) + 2;
      cursor += linesBlock(dLines, innerX, cursor, TYPE.small.size, "normal", C.slate, smallStep) + 1.5;
      linesBlock(tLines, innerX, cursor, TYPE.caption.size, "normal", C.muted, capStep);

      y += cardH + SP.l;
    }

    function legend() {
      var top = y;
      // Same four labels as the results screen legend.
      var items = [
        { c: C.green, label: "Acertada" },
        { c: C.amber, label: "Correcta que no marcaste" },
        { c: C.rose, label: "Fallada" },
        { c: C.badge, label: "Sin responder" },
      ];
      var x = X0;
      items.forEach(function (it) {
        setFill(it.c);
        rrect(x, top + 0.6, 2.6, 2.6, 0.8, "F");
        txt(it.label, x + 4.2, top + 1.9, { size: TYPE.caption.size, color: C.slate, baseline: "middle" });
        x += 4.2 + textWidth(it.label, "normal", TYPE.caption.size) + 8;
      });

      var note =
        "Cada bloque marca en verde las respuestas correctas que elegiste, en ámbar las correctas que " +
        "no marcaste, en rojo las incorrectas marcadas y en gris lo que quedó sin marcar. La barra del " +
        "margen derecho repite el estado de la pregunta.";
      var lines = wrap(note, "normal", TYPE.caption.size, CONTENT_W);
      var h = linesBlock(lines, X0, top + 8, TYPE.caption.size, "normal", C.muted, lh(TYPE.caption.size, 1.45));
      y = top + 8 + h + SP.l;
    }

    // --- section title ---------------------------------------------------
    function sectionTitle(label, count, tone) {
      ensureSpace(50);
      var top = y;
      display(label, X0, top + 7, { size: TYPE.h1.size, color: tone.accent, baseline: "middle" });
      var labelW = textWidth(label, "bold", TYPE.h1.size, DISPLAY);

      var countText = String(count);
      var pillW = pillWidth(countText, "bold", TYPE.small.size, DISPLAY, 0);
      setFill(tone.accent);
      rrect(X0 + labelW + 6, top + 3, pillW, 8, 4, "F");
      txt(countText, X0 + labelW + 6 + pillW / 2, top + 7, {
        family: DISPLAY,
        style: "bold",
        size: TYPE.small.size,
        color: C.white,
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
    var BLOCK = { padT: 5, padB: 5, rule: 1 };
    var IX = X0 + 7; // inner text left
    var IR = X1 - 6; // inner text right
    var IW = IR - IX;
    var TINT_X = IX - 3; // option tint band
    var TINT_W = IR + 3 - TINT_X;

    function layoutQuestion(result) {
      var q = result.question;
      var chips = D.chips(q);
      var chipText = chips
        .map(function (c) {
          return c.label;
        })
        .join("  |  ");
      var status = statusOf(result);
      var tone = STATUS[status];
      var pillText = tone.label;

      var stmtStep = lh(TYPE.body.size, 1.4);
      var stmtLines = wrap(q.text, "bold", TYPE.body.size, IW);

      var optRows = q.options.map(function (o) {
        // Same four option states as the review screen: hit (picked), missed
        // (correct but not picked), wrong (picked and incorrect), plain.
        var inKey = q.answer.includes(o.letter);
        var picked = result.selected.includes(o.letter);
        var kind = inKey && picked ? "hit" : inKey ? "missed" : picked ? "wrong" : "neutral";
        var style = kind === "neutral" ? "normal" : "bold";
        var step = lh(TYPE.body.size, 1.4);
        var lines = wrap(o.text, style, TYPE.body.size, IW - 10.5);
        return {
          letter: o.letter,
          kind: kind,
          style: style,
          lines: lines,
          step: step,
          h: Math.max(8, lines.length * step + 3),
        };
      });

      var hintStep = lh(TYPE.quote.size, 1.42);
      var hintLines = wrap(
        "Directrices: " + (chipText || q.rules),
        TYPE.quote.style,
        TYPE.quote.size,
        TINT_W - 10,
      );
      var hintH = hintLines.length * hintStep + 6;

      // The header row stays whole; the statement flows line by line so a
      // block can start near the bottom of a page without leaving a gap.
      var elements = [
        {
          h: 12,
          draw: function (cy) {
            drawHeadRow(result, tone, pillText, cy);
          },
        },
      ];
      stmtLines.forEach(function (line) {
        elements.push({
          h: stmtStep,
          draw: function (cy) {
            drawStatementLine(line, cy);
          },
        });
      });
      elements.push({ h: SP.s, draw: function () {} });
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

    function drawHeadRow(result, tone, pillText, cy) {
      var q = result.question;
      var rowCenter = cy + 3.25; // one shared centre line for the whole row

      var pw = pillWidth(pillText, "bold", TYPE.caption.size, DISPLAY, 0.3);
      setFill(tone.accent);
      rrect(IX, cy, pw, 6.5, 3.25, "F");
      txt(pillText, IX + pw / 2, rowCenter, {
        family: DISPLAY,
        style: "bold",
        size: TYPE.caption.size,
        color: C.white,
        align: "center",
        baseline: "middle",
        charSpace: 0.3,
      });

      var idText = "Pregunta " + q.id;
      var idX = IX + pw + 6;
      display(idText, idX, rowCenter, { size: TYPE.body.size, color: C.ink, baseline: "middle" });

      var answerText = "Tu respuesta: " + (result.selected.length ? result.selected.join(", ") : "-");
      var answerW = textWidth(answerText, "bold", TYPE.small.size);
      var topic = D.topicLabel(q.topic);
      var topicX = idX + textWidth(idText, "bold", TYPE.body.size, DISPLAY) + 7;
      if (topicX + textWidth(topic, "normal", TYPE.small.size) + 8 + answerW <= IR) {
        txt(topic, topicX, rowCenter, { size: TYPE.small.size, color: C.muted, baseline: "middle" });
      }
      txt(answerText, IR, rowCenter, {
        style: "bold",
        size: TYPE.small.size,
        color: tone.dark,
        align: "right",
        baseline: "middle",
      });

      setDraw(C.line);
      doc.setLineWidth(0.3);
      doc.line(IX, cy + 10.5, IR, cy + 10.5);
    }

    /** One statement line, positioned like a single line of linesBlock. */
    function drawStatementLine(line, cy) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(TYPE.body.size);
      setColor(C.ink);
      doc.text(line, IX, cy + TYPE.body.size * MM_PT * 0.76);
    }

    var OPTION_TINT = {
      hit: C.greenTint,
      missed: C.amberTint,
      wrong: C.roseTint,
      neutral: null,
    };
    var OPTION_BADGE = { hit: C.green, missed: C.amber, wrong: C.rose, neutral: C.badge };
    var OPTION_TEXT = { hit: C.greenDark, missed: C.amberDark, wrong: C.roseDark, neutral: C.slate };

    function drawOption(row, cy) {
      if (row.kind !== "neutral") {
        setFill(OPTION_TINT[row.kind]);
        rrect(TINT_X, cy, TINT_W, row.h, RADIUS.control, "F");
      }

      var badge = OPTION_BADGE[row.kind];
      var bh = 6.5;
      var by = cy + (row.h - bh) / 2;
      setFill(badge);
      rrect(IX, by, bh, bh, RADIUS.control, "F");
      display(row.letter, IX + bh / 2, by + bh / 2, {
        size: TYPE.caption.size,
        color: C.white,
        align: "center",
        baseline: "middle",
      });

      var color = OPTION_TEXT[row.kind];
      // linesBlock anchors the alphabetic baseline, which leaves the em box
      // above the line-box centre; nudge by half a leading so the glyphs sit
      // on the badge centre instead of a millimetre above it.
      var em = TYPE.body.size * MM_PT;
      var textTop = cy + (row.h - row.lines.length * row.step) / 2 + (row.step - em) / 2;
      linesBlock(row.lines, IX + 10.5, textTop, TYPE.body.size, row.style, color, row.step);
    }

    function drawCorrect(result, tone, cy) {
      setFill(tone.accent);
      rrect(IX, cy + 0.8, 3.6, 3.6, 0.6, "F");
      txt("Respuesta correcta: " + result.question.answer.join(", "), IX + 5.6, cy + 4, {
        style: "bold",
        size: TYPE.small.size,
        color: tone.dark,
      });
    }

    function drawHint(lines, step, cy) {
      var boxH = lines.length * step + 6;
      setFill(C.amberWash);
      setDraw(C.amberLine);
      doc.setLineWidth(0.3);
      rrect(TINT_X, cy, TINT_W, boxH, RADIUS.control, "FD");
      setFill(C.amber);
      doc.rect(TINT_X, cy, 1.2, boxH, "F");
      // Vertically centred inside the box, equal padding above and below.
      linesBlock(lines, TINT_X + 5, cy + (boxH - lines.length * step) / 2, TYPE.quote.size, TYPE.quote.style, C.slate, step);
    }

    /**
     * Questions flow to the bottom of the page and continue on the next one
     * (with a "continúa" strip) instead of jumping whole and leaving a large
     * blank area. The header + statement are the only unsplittable unit.
     */
    function drawBlock(result) {
      var layout = layoutQuestion(result);
      var tone = layout.tone;
      var els = layout.elements;
      var q = result.question;

      var segs = [];
      var segTop = y;
      var segPage = pageNo;
      var from = 0;
      var cursor = segTop + BLOCK.padT;
      var i = 0;
      var freshPage = false;

      while (i < els.length) {
        if (cursor + els[i].h + BLOCK.padB <= BOTTOM) {
          cursor += els[i].h;
          i += 1;
          freshPage = false;
          continue;
        }
        if (i === from && !freshPage) {
          // Nothing drawn in this segment yet: retry on a clean page.
          newPage();
          segTop = y;
          segPage = pageNo;
          cursor = y + BLOCK.padT;
          freshPage = true;
          continue;
        }
        if (i === from) {
          // An element taller than the page body: draw it and accept overflow.
          cursor += els[i].h;
          i += 1;
          continue;
        }
        // Never strand a single trailing element (the hint box) alone on the
        // next page: move the previous element with it when possible.
        var end = i;
        var segCursor = cursor;
        if (els.length - i === 1 && i - 1 > from) {
          end = i - 1;
          segCursor = cursor - els[end].h;
        }
        segs.push({ top: segTop, bottom: segCursor + BLOCK.padB, page: segPage, from: from, to: end, cont: from > 0 });
        newPage();
        segTop = y;
        segPage = pageNo;
        from = end;
        i = end;
        cursor = y + BLOCK.padT + 7;
        freshPage = true;
      }
      segs.push({ top: segTop, bottom: cursor + BLOCK.padB, page: segPage, from: from, to: els.length, cont: from > 0 });
      y = cursor + BLOCK.padB;

      var back = pageNo;
      segs.forEach(function (seg) {
        doc.setPage(seg.page);
        setFill(tone.wash);
        rrect(X0, seg.top, CONTENT_W, seg.bottom - seg.top, RADIUS.panel, "F");
        setDraw(tone.line);
        doc.setLineWidth(0.35);
        rrect(X0, seg.top, CONTENT_W, seg.bottom - seg.top, RADIUS.panel, "S");
        setFill(tone.accent);
        // Thin status rule, inset so the card's rounded corners stay clean.
        doc.rect(X1 - 1.8, seg.top + 1.6, BLOCK.rule, seg.bottom - seg.top - 3.2, "F");

        var cy = seg.top + BLOCK.padT;
        if (seg.cont) {
          txt("Pregunta " + q.id + " · continúa", IX, seg.top + BLOCK.padT + 3.2, {
            size: TYPE.caption.size,
            color: tone.dark,
            baseline: "middle",
          });
          setDraw(tone.line);
          doc.setLineWidth(0.3);
          doc.line(IX, seg.top + BLOCK.padT + 7, IR, seg.top + BLOCK.padT + 7);
          cy = seg.top + BLOCK.padT + 7;
        }
        for (var k = seg.from; k < seg.to; k++) {
          els[k].draw(cy);
          cy += els[k].h;
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
          "Catálogo IHF - Test reglas de juego · Catálogo de preguntas IHF (ES) + Resolución de preguntas (EN), jul 2025",
          X0,
          FOOT_Y + 4.4,
          { size: TYPE.caption.size, color: C.muted },
        );
        txt("Test no oficial · Herramienta de estudio independiente no vinculada a la IHF.", X0, FOOT_Y + 8.4, {
          size: TYPE.caption.size,
          color: C.muted,
        });
        txt("Página " + p + " de " + total, X1, FOOT_Y + 4.4, {
          style: "bold",
          size: TYPE.caption.size,
          color: C.slate,
          align: "right",
        });
        txt("non-official-ihf-rule-test.netlify.app", X1, FOOT_Y + 8.4, {
          size: TYPE.caption.size,
          color: C.muted,
          align: "right",
        });
      }
    }

    // --- document --------------------------------------------------------
    header(true);
    summaryCard();
    legend();

    var groups = { accepted: [], partial: [], failed: [] };
    report.results.forEach(function (r) {
      var status = statusOf(r);
      if (status === "accepted") groups.accepted.push(r);
      else if (status === "partial") groups.partial.push(r);
      else groups.failed.push(r);
    });

    if (groups.accepted.length) {
      sectionTitle("Preguntas aceptadas", groups.accepted.length, STATUS.accepted);
      groups.accepted.forEach(function (r) {
        drawBlock(r);
        y += BLOCK_GAP;
      });
    }
    if (groups.partial.length) {
      sectionTitle("Preguntas parciales", groups.partial.length, STATUS.partial);
      groups.partial.forEach(function (r) {
        drawBlock(r);
        y += BLOCK_GAP;
      });
    }
    if (groups.failed.length) {
      sectionTitle("Preguntas falladas", groups.failed.length, STATUS.failed);
      groups.failed.forEach(function (r) {
        drawBlock(r);
        y += BLOCK_GAP;
      });
    }

    footers();

    var stamp = new Date().toISOString().slice(0, 10);
    var filename = filenameFor(report, stamp);
    doc.save(filename);
    return filename;
  }

  global.IHFPdf = {
    generate: generate,
    sanitize: sanitize,
    statusOf: statusOf,
    filenameFor: filenameFor,
    STATUS_LABELS: STATUS_LABELS,
  };
})(globalThis);
