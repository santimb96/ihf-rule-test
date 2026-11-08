import fs from "node:fs";
import { defineConfig } from "vite";

/**
 * The Rules of Game PDF and the two catalogues are linked by relative URL at
 * runtime (footer links and the hint deep links in scripts/data.js), so the
 * build has to ship the folder verbatim instead of fingerprinting it.
 */
function copyAssetsAndDocs() {
  return {
    name: "copy-assets-and-docs",
    closeBundle() {
      if (fs.existsSync("assets")) {
        fs.cpSync("assets", "dist/assets", { recursive: true });
        // The hero screenshot is imported by index.html, so Vite already emits
        // its own hashed copy; the verbatim folder would ship it twice (plus the
        // 350 KB PNG master, which nothing references).
        fs.rmSync("dist/assets/screenshots", { recursive: true, force: true });
      }
      if (fs.existsSync("documents")) {
        fs.cpSync("documents", "dist/documents", { recursive: true });
      }
    },
  };
}

/**
 * Font preloads. @fontsource declares its woff2 files inside the stylesheet, so
 * the browser only discovers them after parsing and applying the CSS: document
 * -> CSS -> font, three levels deep (the "network dependency tree" audit).
 * Hashed font names exist only once the bundle is emitted, so the preload links
 * are injected into the generated HTML at that point. Only the latin subset is
 * preloaded: it covers Spanish accents, and preloading every subset would spend
 * bandwidth on glyphs this catalogue never renders.
 */
function preloadCriticalFonts() {
  var LATIN_SUBSETS = [
    /(^|\/)inter-latin-wght-normal-[^/]+\.woff2$/,
    /(^|\/)archivo-latin-wght-normal-[^/]+\.woff2$/,
  ];
  return {
    name: "preload-critical-fonts",
    apply: "build",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        var fonts = Object.keys(bundle)
          .filter(function (file) {
            return LATIN_SUBSETS.some(function (pattern) {
              return pattern.test(file);
            });
          })
          .sort();
        if (!fonts.length) return;
        var links = fonts
          .map(function (file) {
            return '  <link rel="preload" as="font" type="font/woff2" crossorigin href="/' + file + '">';
          })
          .join("\n");
        Object.keys(bundle).forEach(function (file) {
          var asset = bundle[file];
          if (!file.endsWith(".html") || !asset || asset.type !== "asset") return;
          asset.source = String(asset.source).replace("</head>", links + "\n</head>");
        });
      },
    },
  };
}

/**
 * Catalogue metadata as a virtual module. The setup screen only needs the
 * labels and the per-topic counts, while the 330 KB question dataset can wait
 * until the first "Comenzar test". Deriving the small module from
 * data/questions.js at build time (instead of checking in a second generated
 * file) keeps both from drifting: whatever the extractor wrote is what the
 * entry bundle sees.
 */
function catalogueMeta() {
  var VIRTUAL_ID = "virtual:ihf-catalogue-meta";
  var RESOLVED_ID = "\0" + VIRTUAL_ID;
  return {
    name: "ihf-catalogue-meta",
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      this.addWatchFile("data/questions.js");
      var sandbox = {};
      new Function("globalThis", fs.readFileSync("data/questions.js", "utf8"))(sandbox);
      var data = sandbox.IHF_DATA;
      var counts = {};
      data.topics.forEach(function (topic) {
        counts[topic.id] = 0;
      });
      data.questions.forEach(function (question) {
        counts[question.topic] = (counts[question.topic] || 0) + 1;
      });
      return [
        "export const meta = " + JSON.stringify(data.meta) + ";",
        "export const topics = " + JSON.stringify(data.topics) + ";",
        "export const counts = " + JSON.stringify(counts) + ";",
      ].join("\n");
    },
    configureServer(server) {
      server.watcher.on("change", function (file) {
        if (file.replace(/\\/g, "/").endsWith("data/questions.js")) {
          var mod = server.moduleGraph.getModuleById(RESOLVED_ID);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [copyAssetsAndDocs(), preloadCriticalFonts(), catalogueMeta()],
});
