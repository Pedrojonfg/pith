export const LS_KEY = "ds_api_key";
export const LS_GEMINI_KEY = "gemini_api_key";
export const LS_ACTIVE_SESSION_KEY = "active_session";
export const LS_STUDY_LANG_KEY = "study_lang";
export const LS_STUDY_NOTES_KEY = "study_notes";
export const LS_BLOCK_INDEX_KEY = "block_index";
export const LS_RSVP_DEFAULT_WPM_KEY = "rsvp_default_wpm";
export const LS_RSVP_DEFAULT_WPF_KEY = "rsvp_default_wpf";
export const LS_RSVP_COMPREHENSION_PAUSE_KEY = "rsvp_comprehension_pause";
export const LS_RSVP_COMPREHENSION_EVERY_KEY = "rsvp_comprehension_every";
export const LS_LAST_EXPORT_STATE_KEY = "last_export_state";
export const LS_SESSION_CONCEPTS_KEY = "session_concepts";
export const LS_SESSION_CONCEPTS_BY_BLOCK_KEY = "session_concepts_by_block";
export const LS_SESSION_CONCEPT_HIGHLIGHTS_BY_BLOCK_KEY =
  "session_concept_highlights_by_block";
export const LS_REVIEW_SESSION_MD_KEY = "review_session_markdown";
export const LS_REVIEW_SESSION_RESULTS_KEY = "review_session_results";
/** Per-session review config draft: focus text + selected block indices (not shared across sessions). */
export const LS_REVIEW_CONFIG_PREFIX = "review_session_config_";
export const LS_SESSION_DEFAULT_Q_CONFIG_KEY = "session_default_q_config";

/** Maximum test (MCQ) questions per study block. */
export const MAX_N_TEST = 10;

export const DS_CHAT_COMPLETIONS_URL =
  "https://api.deepseek.com/v1/chat/completions";

export const GEMINI_OPENAI_CHAT_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export const STUDY_LANG_OPTIONS = [
  { value: "English", label: "English" },
  { value: "Español", label: "Español" },
  { value: "Français", label: "Français" },
  { value: "Deutsch", label: "Deutsch" },
];
