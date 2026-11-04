/**
 * Read-only access to the generated dataset plus the parsing of the answer
 * catalogue's "Rules reference" field into human readable hint chips, each
 * deep-linked to the right page of the Rules of Game PDF.
 */
(function (global) {
  "use strict";

  var data = global.IHF_DATA;
  if (!data) throw new Error("IHF_DATA is not loaded");

  var RULES_PDF = "documents/Reglas de Juego (Septiembre 2025) Web.pdf";

  var TOPIC_PAGE = {};
  data.topics.forEach(function (topic) {
    TOPIC_PAGE[topic.id] = topic.rulesPage;
  });

  // Chapter starts inside the Rules of Game PDF for references that are not
  // plain rule paragraphs (Aclaraciones = II, Zona de cambios = III, Directrices = IV).
  var SPECIAL_PAGES = [
    { test: /aclaraci[oó]n|clarification/i, page: 68 },
    { test: /directriz|guideline/i, page: 95 },
    { test: /zona de cambios|substitution area/i, page: 92 },
    { test: /ap[eé]ndice|appendix/i, page: 68 },
  ];

  var ORDINALS = { first: "1er", second: "2º", third: "3er" };

  function translate(segment) {
    var rules;
    if ((rules = segment.match(/^electronic team time-out regulations$/i))) return "Reglamento de tiempo muerto electrónico";
    if ((rules = segment.match(/^video replay regulations$/i))) return "Reglamento de video replay";
    if ((rules = segment.match(/^substitution area regulations\s*(.*)$/i))) return "Reglamento de zona de cambios" + (rules[1] ? " " + rules[1] : "");
    if ((rules = segment.match(/^regulations on protective equipment and accessories$/i))) return "Reglamento de equipación y accesorios protectores";
    if ((rules = segment.match(/^appendix\s*(.*)$/i))) return "Apéndice " + rules[1];
    if (/^hand signals$/i.test(segment)) return "Gestoformas";
    if ((rules = segment.match(/^in connection with\s*(.*)$/i))) return "en relación con " + rules[1];
    return null;
  }

  function labelFor(segment) {
    var s = segment.trim();
    var m;

    // Plain rule paragraph: "2:10", "16:3a", "7:11-12", "2:2 comment", "12:1 – Hand signals".
    if ((m = s.match(/^(\d{1,2})[:.](\d+[a-z]?(?:-\d+[a-z])?)([\s\S]*)$/i))) {
      var label = "Regla " + m[1] + ":" + m[2];
      var tail = m[3].trim();
      if (!tail) return label;
      if (/^comments?$/i.test(tail)) return label + " (comentario)";
      if (/^note$/i.test(tail)) return label + " (nota)";
      if (/hand signals/i.test(tail)) return label + " (gestoformas)";
      if (/^and guideline/i.test(tail)) return label + " + directriz";
      return label + " · " + tail;
    }

    // Clarifications from section II of the Rules of Game.
    if ((m = s.match(/^(?:clarification|aclaraci[oó]n)\s*(?:no\.?\s*)?([\s\S]*)$/i))) {
      var rest = (m[1] || "").trim().replace(/\band\b/gi, "y");
      return rest ? "Aclaración " + rest : "Aclaración";
    }

    if (/^guidelines$/i.test(s)) return "Directrices";
    if (/^new guideline$/i.test(s)) return "Directriz nueva";
    if ((m = s.match(/^guideline\s+rule\s+([\s\S]*)$/i))) return "Directriz regla " + m[1];
    if ((m = s.match(/^guideline\s+([\s\S]*)$/i))) {
      return m[1].trim() ? "Directriz " + m[1].trim() : "Directriz";
    }

    if ((m = s.match(/^(\d+)(?:st|nd|rd|th)\s+paragraph$/i))) return m[1] + "º párrafo";
    if ((m = s.match(/^(first|second|third)\s+paragraph$/i))) return ORDINALS[m[1].toLowerCase()] + " párrafo";
    if ((m = s.match(/^paragraph\s+(\d+)$/i))) return "Párrafo " + m[1];
    if (/^comments$/i.test(s)) return "Comentarios";
    if (/^comment$/i.test(s)) return "Comentario";
    if (/^note$/i.test(s)) return "Nota";

    return translate(s) || s;
  }

  function pageFor(segment, question) {
    var m = segment.match(/^(\d{1,2})[:.]/);
    if (m && TOPIC_PAGE[m[1]]) return TOPIC_PAGE[m[1]];
    for (var i = 0; i < SPECIAL_PAGES.length; i++) {
      if (SPECIAL_PAGES[i].test.test(segment)) return SPECIAL_PAGES[i].page;
    }
    // Standalone regulations (video replay, team time-out...) are not in the rules PDF.
    if (/regulations/i.test(segment) && !/substitution area/i.test(segment)) return null;
    return TOPIC_PAGE[question.topic] || null;
  }

  function chips(question) {
    var seen = {};
    return question.rules
      .split(",")
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean)
      .map(function (segment) {
        var label = labelFor(segment);
        if (seen[label]) return null;
        seen[label] = true;
        return { raw: segment, label: label, page: pageFor(segment, question) };
      })
      .filter(Boolean);
  }

  function rulesUrl(page) {
    return page ? encodeURI(RULES_PDF) + "#page=" + page : null;
  }

  var api = {
    meta: data.meta,
    topics: function () {
      return data.topics;
    },
    questions: function () {
      return data.questions;
    },
    topicLabel: function (id) {
      var found = data.topics.filter(function (t) {
        return t.id === id;
      })[0];
      return found ? found.label : id;
    },
    pool: function (topicIds) {
      var wanted = new Set(topicIds);
      return data.questions.filter(function (q) {
        return wanted.has(q.topic);
      });
    },
    chips: chips,
    rulesUrl: rulesUrl,
  };

  global.IHFData = api;
})(globalThis);
