## 1. Auth & App Boot

| id | name | entry_point | files_involved | trigger | depends_on | current_logging_state | error_handling_state | static_risk_assessment | is_critical_path_for_demo |
|----|------|-------------|----------------|---------|------------|----------------------|---------------------|------------------------|---------------------------|
| `auth-google-oauth` | Google OAuth | `auth.js` | `auth.js`, `main.js` | click | Supabase | minimal | try-catch | likely-fragile — blocks | yes |
| `boot-storage-migrate` | Storage migrate | `main.js` | `main.js` | boot | — | unknown | unknown | unknown — not traced | no |

## 2. Input Normalization

| id | name | entry_point | files_involved | trigger | depends_on | current_logging_state | error_handling_state | static_risk_assessment | is_critical_path_for_demo |
|----|------|-------------|----------------|---------|------------|----------------------|---------------------|------------------------|---------------------------|
| `input-normalize-study-material` | Normalize | `input-normalization.js` | `input-normalization.js`, `study.js` | upload | `auth-google-oauth` | adequate | surfaces | likely-fine | yes |
| `llm-c-misc-enrichment` | Misc enrichment | `api.js` | `api.js`, `llm.js` | various | — | minimal | logs | likely-fragile | no |
