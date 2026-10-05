import { analyzeText } from "../recommendation/analyzer.js";
import { buildDeterministicPedagogicalMeta } from "../normalization/hierarchy.js";
import { decideSlowReadingModifiers } from "../slow/reading-modifiers.js";
import { normalizeLlmModel } from "../llm.js";
import { getStudyLanguage } from "../ui.js";

export function createClozeSession({
  normalizedText,
  normalizedFormat,
  fileName,
  originalFormat,
  llmModel,
  language,
}) {
  const lang = String(language || getStudyLanguage()).trim() || "English";
  return {
    studyMode: "cloze",
    rev: 0,
    language: lang,
    llmModel: normalizeLlmModel(llmModel),
    materialMeta: {
      fileName: String(fileName || "").trim(),
      originalFormat: String(originalFormat || "").trim(),
      uploadedAt: new Date().toISOString(),
    },
    cloze: {
      normalizedText: String(normalizedText || ""),
      normalizedFormat: normalizedFormat === "html_min" ? "html_min" : "markdown",
      pipelineStatus: "normalized",
      pipelinePhase: null,
      pipelineError: null,
      epistemicGraph: null,
      analysis: null,
      items: [],
      studyIndex: 0,
      studyStats: { correct: 0, shown: 0 },
      studyOrder: null,
      generationMeta: null,
    },
  };
}

export function createSlowSession({
  normalizedText,
  normalizedFormat,
  fileName,
  originalFormat,
  llmModel,
  language,
  textMetrics = null,
  pedagogicalMeta = null,
  pdfSource = null,
} = {}) {
  const lang = String(language || getStudyLanguage()).trim() || "English";
  const text = String(normalizedText || "");
  const metrics =
    textMetrics && typeof textMetrics === "object"
      ? textMetrics
      : analyzeText(text);
  const pedagogy =
    pedagogicalMeta && typeof pedagogicalMeta === "object"
      ? pedagogicalMeta
      : buildDeterministicPedagogicalMeta(metrics);
  const modifiers = decideSlowReadingModifiers(metrics, pedagogy);
  return {
    studyMode: "slow",
    rev: 0,
    language: lang,
    llmModel: normalizeLlmModel(llmModel),
    docHierarchy: null,
    materialMeta: {
      fileName: String(fileName || "").trim(),
      originalFormat: String(originalFormat || "").trim(),
      uploadedAt: new Date().toISOString(),
    },
    slow: (() => {
      const viewerMode = String(originalFormat || "").trim().toLowerCase() === "pdf" ? "pdf" : "scroll";
      const base = {
        normalizedTextFull: text,
        normalizedFormat: normalizedFormat === "html_min" ? "html_min" : "markdown",
        phase: "phase0",
        viewerMode,
        annotationSchemaVersion: 2,
        criticalMode: Boolean(modifiers.criticalMode),
        fillableMapMode: Boolean(modifiers.fillableMap),
        checkpointsEnabled: Boolean(modifiers.checkpoints),
        phase0SeenKey: null,
        phase0SeenReread: false,
        phase0Collapsed: false,
        phase0: null,
        phase0Status: "idle",
        typography: { fontSizePx: 15, lineHeight: 1.4, fontFamily: '"DM Sans", sans-serif' },
        annotations: [],
        findings: [],
        checkpointsDismissed: [],
        depthScore: null,
        graphEnrichedUnlocked: false,
        graphNodes: [],
        sidebarOpen: true,
      };
      if (viewerMode === "pdf") {
        return {
          ...base,
          currentPdfPage: 1,
          pdfPageCount: 0,
          maxReadPdfPage: 1,
          pdfSource: pdfSource && typeof pdfSource === "object" ? pdfSource : null,
        };
      }
      return {
        ...base,
        scrollAnchorBlockId: null,
        scrollAnchorOffset: 0,
        maxReadCharEnd: 0,
      };
    })(),
  };
}
