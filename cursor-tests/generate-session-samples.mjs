/**
 * Generates generic completed-session markdown samples for manual review.
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/generate-session-samples.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resetStorage } from "./setup-dom.mjs";
import {
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
  LS_SESSION_CONCEPTS_KEY,
} from "../src/js/config.js";
import { buildMarkdown } from "../src/js/export.js";
import { computeDepthScore } from "../src/js/slow/gamification.js";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(projectRoot, "fixtures", "session-samples");

function writeSample(name, text) {
  fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, name);
  fs.writeFileSync(filePath, text, "utf8");
  console.log(`Wrote ${filePath} (${text.length} chars)`);
}

resetStorage();
globalThis.window = globalThis.window || {};

// ─── Slow mode — sesión completa ─────────────────────────────────────────────

const slowAnnotations = [
  {
    id: "ann-01",
    type: "→",
    charStart: 142,
    charEnd: 198,
    userText:
      "El autor no solo describe el fenómeno: lo encuadra como problema de coordinación entre agentes con información parcial.",
  },
  {
    id: "ann-02",
    type: "≈",
    charStart: 310,
    charEnd: 365,
    userText: "Como un mercado con fricciones: el precio no refleja todo al instante.",
    graphLinks: [{ termId: "coordination", relation: "relates" }],
  },
  {
    id: "ann-03",
    type: "?",
    charStart: 420,
    charEnd: 455,
    userText: "¿Por qué asume simetría entre las partes si el texto menciona poder desigual?",
  },
  {
    id: "ann-04",
    type: "⟷",
    charStart: 512,
    charEnd: 580,
    userText: "Conecta con el capítulo 2: la misma lógica de externalidades positivas.",
    graphLinks: [
      { termId: "externalidad", relation: "relates" },
      { termId: "cap2", relation: "relates" },
    ],
  },
  {
    id: "ann-05",
    type: "⊘",
    charStart: 640,
    charEnd: 710,
    userText:
      "Objeción: trata la evidencia empírica como secundaria; la inferencia causal no está justificada.",
  },
  {
    id: "ann-06",
    type: "↯",
    charStart: 780,
    charEnd: 830,
    userText: "Tensión entre optimismo normativo y datos que muestran persistencia del problema.",
  },
  {
    id: "ann-07",
    type: "⚠",
    charStart: 890,
    charEnd: 940,
    userText: "Falta contraste con el contraejemplo de mercados regulados que sí coordinan.",
  },
  {
    id: "ann-08",
    type: "★",
    charStart: 1005,
    charEnd: 1060,
    userText: "Argumento fuerte: separa claramente fallo de mercado de fallo institucional.",
  },
  {
    id: "ann-09",
    type: "⇑",
    charStart: 1120,
    charEnd: 1210,
    userText:
      "Steel man: aun sin datos perfectos, el marco predictivo ayuda a diseñar intervenciones mínimas.",
  },
  {
    id: "ann-10",
    type: "⚑",
    charStart: 1250,
    charEnd: 1280,
    userText: "¿Qué autores citan sobre coordinación sin contrato explícito?",
    aiReply:
      "El material cita a Schelling (1960) sobre focal points y a Olson (1965) sobre acción colectiva; no desarrolla contratos incompletos.",
  },
  {
    id: "ann-11",
    type: "≈",
    charStart: 1320,
    charEnd: 1340,
    userText: "",
  },
  {
    id: "ann-12",
    type: "ia-query",
    charStart: 1380,
    charEnd: 1410,
    userText: "Resume la tesis en una frase.",
    aiReply: "La tesis: los mercados fallan en coordinar cuando la información es costosa de verificar.",
  },
];

const slowSession = {
  studyMode: "slow",
  language: "Spanish",
  materialMeta: { fileName: "economia-coordinacion-cap3.md" },
  n_blocks: 0,
  blocks: [
    {
      concepts: [
        {
          term: "Coordination failure",
          definition:
            "Situación en la que agentes racionales no alcanzan un equilibrio eficiente por falta de mecanismos que alineen expectativas, aun cuando existen ganancias mutuas potenciales.",
        },
        {
          term: "Información verificable",
          definition:
            "En el texto, información cuya veracidad puede comprobarse a coste razonable por terceros o por el propio mercado; su ausencia impide contratos completos.",
        },
      ],
    },
  ],
  slow: {
    phase: "complete",
    criticalMode: true,
    fillableMapMode: true,
    graphEnrichedUnlocked: true,
    readingScope: { label: "Capítulo 3 — Coordinación e información", charStart: 0, charEnd: 4200 },
    phase0: {
      thesis:
        "Los mercados no fallan solo por externalidades clásicas, sino porque la verificación de información tiene costes que impiden acuerdos eficientes.",
      guideQuestion: "¿Qué mecanismo concreto propone el autor para reducir el coste de verificación?",
      prequestions: [
        "¿Qué problema central plantea el capítulo?",
        "¿Qué evidencia usa el autor para sostener la tesis?",
        "¿Qué supuestos implícitos hay sobre el comportamiento de los agentes?",
      ],
      argumentMap: [
        { id: "P1", text: "La información relevante es costosa de verificar.", status: "argued" },
        { id: "P2", text: "Sin verificación, los contratos quedan incompletos.", status: "argued" },
        { id: "P3", text: "Los agentes anticipan incumplimiento y sub-invierten.", status: "partial" },
        { id: "C", text: "Por tanto, la coordinación requiere instituciones intermediarias.", status: "argued" },
      ],
      fillableBlanks: [
        { slotId: "P1-evidence", userAnswer: "Estudios de microcrédito con auditorías aleatorias" },
        { slotId: "C-institution", userAnswer: "Certificadores privados y estándares sectoriales" },
        { slotId: "implicit-assumption", userAnswer: "(empty)" },
      ],
      conceptsToFind: [
        { term: "Coordination failure", authorUsage: "Fallo cuando expectativas no convergen pese a ganancias mutuas." },
        { term: "Información verificable", authorUsage: "Condición necesaria para contratos completos en el modelo." },
        { term: "Institución intermediaria", authorUsage: "Actor que reduce costes de verificación sin ser el Estado." },
      ],
      criticalExaminePoints: [
        "¿La evidencia empírica respalda la magnitud del efecto que atribuye al coste de verificación?",
        "¿El marco excluye soluciones descentralizadas basadas en reputación?",
        "¿La distinción fallo de mercado / fallo institucional es operativa en el caso límite?",
      ],
    },
    annotations: slowAnnotations,
    findings: [
      {
        conceptTerm: "Coordination failure",
        userText: "El autor lo ilustra con el ejemplo del mercado de semillas: nadie invierte sin garantía de calidad.",
        revealedInPhase1: false,
      },
      {
        conceptTerm: "Información verificable",
        userText: "Aparece de forma explícita solo al final; antes se usa el sinónimo 'observable'.",
        revealedInPhase1: true,
      },
      {
        conceptTerm: "Institución intermediaria",
        userText: "No lo nombra así; habla de 'third-party certifiers'.",
        revealedInPhase1: false,
      },
    ],
    depthScore: computeDepthScore(slowAnnotations, { criticalMode: true }),
    graphNodes: [
      { id: "user-ann-02", label: "Paralelo mercado con fricciones", sourceAnnotationId: "ann-02" },
      { id: "user-ann-04", label: "Enlace capítulo 2", sourceAnnotationId: "ann-04" },
    ],
  },
  _meta: {
    session_id: "sample-slow-001",
    rev: 12,
    duration_min: 47,
    student_synthesis:
      "El capítulo articula un fallo de coordinación distinto al de externalidades clásicas: el coste de verificar información impide contratos completos. Las objeciones (⊘) sobre evidencia empírica chocan con un steel-man útil sobre intervenciones mínimas.",
    study_notes: "Repaso antes del parcial. Priorizar objeciones ⊘ y steel-man ⇑.",
  },
};

localStorage.setItem(
  LS_SESSION_CONCEPTS_KEY,
  JSON.stringify([
    {
      term: "Focal point",
      definition:
        "Punto de referencia compartido que permite coordinación sin comunicación explícita (Schelling); el material lo menciona al hablar de expectativas convergentes.",
    },
  ]),
);

const slowMd = buildMarkdown(slowSession);
writeSample("generic-slow-mode-session.md", slowMd);

// ─── Fast mode (RSVP) — sesión completa ────────────────────────────────────

resetStorage();
globalThis.window.guideHistory = [
  {
    role: "user",
    content: "¿Por dónde empiezo si ya sé cálculo pero no física?",
    timestamp: new Date("2026-06-07T10:15:00").getTime(),
  },
  {
    role: "assistant",
    content:
      "Empieza por el bloque 1 (vectores y campos). Tu base en cálculo te ayuda con gradiente y divergencia; el bloque 2 conecta eso con flujo.",
    timestamp: new Date("2026-06-07T10:16:00").getTime(),
  },
  {
    role: "user",
    content: "¿El teorema de Stokes es imprescindible para el examen?",
    timestamp: new Date("2026-06-07T10:22:00").getTime(),
  },
  {
    role: "assistant",
    content:
      "Sí para el apartado de integrales de línea. Enfócate en la intuición geométrica: circulación = suma de rotaciones locales.",
    timestamp: new Date("2026-06-07T10:23:00").getTime(),
  },
  {
    role: "user",
    content: "Nota: repasar unidades en problemas de flujo antes del bloque 3.",
    timestamp: new Date("2026-06-07T10:45:00").getTime(),
    meta: { fromPendingComment: false },
  },
  {
    role: "user",
    content: "Pendiente: verificar signo de la normal en superficies orientadas.",
    timestamp: new Date("2026-06-07T11:02:00").getTime(),
    meta: { fromPendingComment: true },
  },
];

localStorage.setItem(
  LS_SESSION_CONCEPTS_KEY,
  JSON.stringify([
    { term: "Gradiente", definition: "Vector de derivadas parciales; apunta hacia mayor incremento del campo escalar." },
  ]),
);
localStorage.setItem(
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
  JSON.stringify({
    0: [
      {
        term: "Campo vectorial",
        definition:
          "Función que asigna un vector a cada punto del espacio; en el material, modela velocidad de fluido o fuerza.",
      },
    ],
    1: [
      {
        term: "Flujo",
        definition:
          "Integral de superficie del producto escalar F·n sobre una superficie orientada; mide cuánto del campo atraviesa la superficie por unidad de tiempo.",
      },
      {
        term: "Divergencia",
        definition:
          "Operador ∇·F que mide la tendencia neta de un campo vectorial a 'expandirse' o 'contraerse' en un punto.",
      },
    ],
    2: [
      {
        term: "Circulación",
        definition:
          "Integral de línea de F sobre una curva cerrada; cuantifica la componente rotacional acumulada del campo a lo largo del contorno.",
      },
    ],
  }),
);

const fastSession = {
  studyMode: "rsvp",
  language: "Spanish",
  materialMeta: { fileName: "calculo-vectorial-cap2.md", format: "md" },
  n_blocks: 3,
  n_test: 3,
  n_socratic: 1,
  current_block_index: 2,
  blocks_list_text:
    "1. Vectores y campos\n2. Flujo y divergencia\n3. Circulación y Stokes",
  blocks: [
    {
      title: "Vectores y campos",
      explanation:
        "Repaso de campos escalares y vectoriales. El gradiente de un campo escalar φ apunta en la dirección de máximo crecimiento. Un campo vectorial F(x,y,z) asigna magnitud y dirección en cada punto — por ejemplo velocidad de un fluido.",
      questions: [
        {
          type: "test",
          question: "¿Qué representa geométricamente el gradiente de un campo escalar?",
        },
        {
          type: "test",
          question: "¿Cuál es la diferencia entre magnitud y dirección en un campo vectorial?",
        },
        {
          type: "test",
          question: "Si φ(x,y)=x²+y², ¿hacia dónde apunta ∇φ en (1,0)?",
        },
        { type: "socratic", question: "¿Por qué un campo constante tiene gradiente cero?" },
      ],
      concepts: [{ term: "Gradiente", definition: "Vector de derivadas parciales de un campo escalar." }],
    },
    {
      title: "Flujo y divergencia",
      explanation:
        "El flujo de F a través de una superficie S mide el caudal neto. La divergencia ∇·F en un punto indica si el campo actúa como fuente (positiva) o sumidero (negativa). Teorema de la divergencia: integrales de volumen de ∇·F igualan flujo por la frontera.",
      questions: [
        {
          type: "test",
          question: "¿Qué mide el flujo de un campo vectorial a través de una superficie orientada?",
        },
        {
          type: "test",
          question: "Si ∇·F > 0 en una región, ¿qué interpretación física tiene?",
        },
        {
          type: "test",
          question: "Enuncia el teorema de la divergencia en una frase.",
        },
        {
          type: "socratic",
          question: "Relaciona divergencia positiva con la imagen de una fuente de fluido.",
        },
      ],
      concepts: [
        { term: "Flujo", definition: "∬ F·n dS sobre superficie orientada." },
        { term: "Divergencia", definition: "∇·F; expansión/contracción local del campo." },
      ],
    },
    {
      title: "Circulación y Stokes",
      explanation:
        "La circulación ∮ F·dr sobre una curva cerrada captura rotación global. El rotacional curl F mide rotación infinitesimal. Teorema de Stokes: circulación = flujo del rotacional a través de la superficie limitada por la curva.",
      questions: [
        {
          type: "test",
          question: "¿Qué relaciona el teorema de Stokes?",
        },
        {
          type: "test",
          question: "¿Cuándo es cero la circulación de un campo conservativo?",
        },
        {
          type: "test",
          question: "¿Qué es curl F en términos de derivadas cruzadas?",
        },
        { type: "socratic", question: "Compara Stokes con el teorema de Green en 2D." },
      ],
      concepts: [{ term: "Circulación", definition: "Integral de línea sobre curva cerrada." }],
    },
  ],
  _responses: {
    blocks: {
      0: {
        questions: {
          0: { user_answer: "A", feedback: "Correcto.", correct_answer: "A", answered_at: "2026-06-07T10:18:22.000Z" },
          1: { user_answer: "B", feedback: "Bien explicado.", correct_answer: "B", answered_at: "2026-06-07T10:19:05.000Z" },
          2: {
            user_answer: "B",
            feedback: "Revisa el cálculo: ∇φ = (2x, 2y), en (1,0) apunta en +x.",
            correct_answer: "A",
            answered_at: "2026-06-07T10:20:11.000Z",
            error_type: "calculation_error",
          },
          3: {
            user_answer: "Porque no hay variación espacial.",
            feedback: "Buena intuición.",
            correct_answer: "Derivadas parciales nulas ⇒ gradiente cero.",
            answered_at: "2026-06-07T10:21:40.000Z",
            socratic_mode: "free",
          },
        },
      },
      1: {
        questions: {
          0: { user_answer: "A", feedback: "Correcto.", correct_answer: "A", answered_at: "2026-06-07T10:28:00.000Z" },
          1: { user_answer: "C", feedback: "Correcto.", correct_answer: "C", answered_at: "2026-06-07T10:29:12.000Z" },
          2: {
            user_answer: "D",
            feedback: "Repasa: ∫∫∫ ∇·F dV = ∬ F·n dS.",
            correct_answer: "A",
            answered_at: "2026-06-07T10:31:44.000Z",
            error_type: "formula_recall",
          },
          3: {
            user_answer: "Más fluido sale que entra en cada punto.",
            feedback: "Aceptable para socrático.",
            correct_answer: "N/A (socrático).",
            answered_at: "2026-06-07T10:33:20.000Z",
            socratic_mode: "guided",
          },
        },
      },
      2: {
        questions: {
          0: { user_answer: "A", feedback: "Correcto.", correct_answer: "A", answered_at: "2026-06-07T10:40:00.000Z" },
          1: {
            user_answer: "C",
            feedback: "Solo si el campo es conservativo en la región simplemente conexa.",
            correct_answer: "B",
            answered_at: "2026-06-07T10:41:30.000Z",
            error_type: "conceptual_confusion",
          },
          2: {
            user_answer: "A",
            feedback: "Correcto en espíritu; repasa las tres componentes.",
            correct_answer: "A",
            answered_at: "2026-06-07T10:42:55.000Z",
          },
          3: {
            user_answer: "",
            feedback: "Pendiente de completar.",
            correct_answer: "Green es caso 2D de Stokes.",
            socratic_mode: "free",
          },
        },
      },
    },
  },
  _meta: {
    session_id: "sample-fast-001",
    rev: 8,
    duration_min: 47,
    student_synthesis:
      "Sesión de repaso vectorial: sólida en gradiente y flujo, débil en enunciados formales (divergencia, Stokes/Green). Priorizar teoremas en bloques 2–3.",
    study_notes: "Sesión de repaso vectorial antes del parcial. Bloque 3 más débil.",
    assessment: {
      max_questions: 6,
      penalised_total: 3.5,
      pct: 58,
      strong_blocks: [1],
      weak_blocks: [2, 3],
      config_adjustments_applied: true,
      gaps_source: "assessment_llm",
      synthesis_status: "confirmed",
      gaps_by_block: {
        2: [
          { label: "Teorema de la divergencia — enunciado formal", source: "llm" },
          { label: "Interpretación física de flujo con signo de n", source: "user" },
        ],
        3: [
          { label: "Stokes vs Green", source: "llm" },
          { label: "Condiciones para circulación cero", source: "llm" },
        ],
      },
    },
    material_graph: {
      conceptInventory: [
        { id: "grad", order: 1, title: "Gradiente", prerequisite_ids: [] },
        { id: "field", order: 2, title: "Campo vectorial", prerequisite_ids: ["grad"] },
        { id: "flux", order: 3, title: "Flujo", prerequisite_ids: ["field"] },
        { id: "div", order: 4, title: "Divergencia", prerequisite_ids: ["flux"] },
        { id: "circ", order: 5, title: "Circulación", prerequisite_ids: ["field"] },
        { id: "stokes", order: 6, title: "Teorema de Stokes", prerequisite_ids: ["circ", "div"] },
      ],
      blockIndex: [
        { id: 1, title: "Vectores y campos", concept_ids: ["grad", "field"], signature: ["gradiente", "campo"] },
        { id: 2, title: "Flujo y divergencia", concept_ids: ["flux", "div"], signature: ["flujo", "divergencia"] },
        { id: 3, title: "Circulación y Stokes", concept_ids: ["circ", "stokes"], signature: ["circulacion", "stokes"] },
      ],
    },
  },
};

const fastMd = buildMarkdown(fastSession);
writeSample("generic-fast-mode-session.md", fastMd);

console.log("\nDone. Samples are in fixtures/session-samples/");
