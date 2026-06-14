/**
 * Study Projects T01 — session-types Project typedefs, MISC_PROJECT_ID, projectId validation
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260623_t01-session-types.mjs
 */
import { MISC_PROJECT_ID, validateDocumentSession } from "../src/js/session-types.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

/** Minimal valid DocumentSession fixture (no projectId — legacy pre-migration). */
function minimalSession(overrides = {}) {
  const now = Date.now();
  return {
    docId: "abc123def456",
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
    shared: {
      rawMarkdown: "# Sample\n\nBody text.",
      docMeta: {
        titleInferred: "Sample",
        charCount: 20,
        language: "en",
        estimatedGenre: "unknown",
      },
      docHierarchy: null,
      conceptInventory: [],
      annotations: [],
      smItems: [],
      modeRecommendation: null,
      uploadMeta: null,
      assessmentSignals: [],
      docTopics: [],
    },
    modes: { rsvp: null, slow: null, cloze: null, questions: null, recall: null },
    ...overrides,
  };
}

// --- MISC_PROJECT_ID export ---

assert(MISC_PROJECT_ID === "misc", "MISC_PROJECT_ID is 'misc'");
assert(typeof MISC_PROJECT_ID === "string", "MISC_PROJECT_ID is a string");

// --- Legacy sessions without projectId validate (migration backfills later) ---

const legacy = minimalSession();
assert(legacy.projectId == null, "fixture: projectId absent pre-migration");
const legacyValid = validateDocumentSession(legacy);
assert(legacyValid.ok, `legacy session without projectId validates (${legacyValid.errors.join(", ")})`);

// --- Sessions with valid projectId validate ---

const withProject = minimalSession({ projectId: MISC_PROJECT_ID });
const withProjectValid = validateDocumentSession(withProject);
assert(withProjectValid.ok, `session with projectId=${MISC_PROJECT_ID} validates`);

const customProject = minimalSession({
  projectId: "550e8400-e29b-41d4-a716-446655440000",
});
assert(validateDocumentSession(customProject).ok, "session with UUID projectId validates");

// --- Invalid projectId rejected when present ---

const emptyProjectId = minimalSession({ projectId: "" });
const emptyValid = validateDocumentSession(emptyProjectId);
assert(!emptyValid.ok, "empty projectId rejected");
assert(
  emptyValid.errors.some((e) => e.includes("projectId")),
  "empty projectId error mentions projectId",
);

const whitespaceProjectId = minimalSession({ projectId: "   " });
assert(!validateDocumentSession(whitespaceProjectId).ok, "whitespace-only projectId rejected");

const numericProjectId = minimalSession({ projectId: 42 });
const numericValid = validateDocumentSession(numericProjectId);
assert(!numericValid.ok, "non-string projectId rejected");
assert(
  numericValid.errors.some((e) => e.includes("projectId")),
  "non-string projectId error mentions projectId",
);

// --- Import surface ---

const reimport = await import("../src/js/session-types.js");
assert(
  reimport.MISC_PROJECT_ID === "misc",
  "named import { MISC_PROJECT_ID } from session-types works",
);

console.log(`\n20260623_t01-session-types: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
