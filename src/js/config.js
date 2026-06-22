export const LS_ACTIVE_SESSION_KEY = "active_session";
export const LS_SESSIONS_BY_MODE_KEY = "sessions_by_mode";
export const LS_DEFAULT_LLM_MODEL_KEY = "default_llm_model";
export const LS_SOURCE_FIDELITY_STRICT_KEY = "source_fidelity_strict";
export const LS_STUDY_LANG_KEY = "study_lang";
export const LS_STUDY_NOTES_KEY = "study_notes";
export const LS_BLOCK_INDEX_KEY = "block_index";
export const LS_RSVP_DEFAULT_WPM_KEY = "rsvp_default_wpm";
export const LS_RSVP_DEFAULT_WPF_KEY = "rsvp_default_wpf";
export const LS_RSVP_COMPREHENSION_PAUSE_KEY = "rsvp_comprehension_pause";
export const LS_RSVP_COMPREHENSION_EVERY_KEY = "rsvp_comprehension_every";
/** `"rsvp"` (default) | `"paced"` — block reading style in fast mode */
export const LS_RSVP_READING_MODE_KEY = "rsvp_reading_mode";
export const LS_LAST_EXPORT_STATE_KEY = "last_export_state";
export const LS_SESSION_CONCEPTS_KEY = "session_concepts";
export const LS_SESSION_CONCEPTS_BY_BLOCK_KEY = "session_concepts_by_block";
export const LS_SESSION_CONCEPT_HIGHLIGHTS_BY_BLOCK_KEY =
  "session_concept_highlights_by_block";
export const LS_REVIEW_SESSION_MD_KEY = "review_session_markdown";
export const LS_REVIEW_SESSION_RESULTS_KEY = "review_session_results";
/** Per-session review config draft: focus text + selected block indices (not shared across sessions). */
export const LS_REVIEW_CONFIG_PREFIX = "review_session_config_";
/** Per-session spaced-repetition flashcards queued from Slow Mode (T12). */
export const LS_REVIEW_FLASHCARDS_PREFIX = "review_flashcards_";
export const LS_SESSION_DEFAULT_Q_CONFIG_KEY = "session_default_q_config";

/** DocumentSession V2 — unified cross-mode storage */
export const LS_DOC_SESSIONS_KEY = "pith_doc_sessions";
export const LS_ACTIVE_DOC_ID_KEY = "pith_active_doc_id";
export const LS_DOC_TEXT_PREFIX = "pith_doc_text_";
export const LS_DOC_BLOCKS_PREFIX = "pith_doc_blocks_";
export const LS_DOC_RESPONSES_PREFIX = "pith_doc_responses_";
export const LS_V1_BACKUP_KEY = "pith_v1_backup";
export const LS_PROJECTS_KEY = "mylearning_projects";

/** Externalize RSVP blocks when inline JSON exceeds this size (bytes). */
export const BLOCKS_INLINE_THRESHOLD = 200 * 1024;

/** Externalize rawMarkdown when serialized session exceeds this size (bytes). */
export const DOC_SESSION_SIZE_THRESHOLD = 400 * 1024;

/** Maximum test (MCQ) questions per study block. */
export const MAX_N_TEST = 10;

/** Holistic pre-packing assessment totals (test + socratic). */
export const HOLISTIC_ASSESSMENT_MAX = 50;
export const HOLISTIC_ASSESSMENT_MIN = 8;

export const STUDY_LANG_OPTIONS = [
  { value: "English", label: "English" },
  { value: "Spanish", label: "Spanish" },
  { value: "French", label: "French" },
  { value: "German", label: "German" },
];
