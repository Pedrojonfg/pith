/**
 * LLM calls for interview follow-up and synthesis (20260620-nodoc-interview-capture).
 */

import { llmChatCompletions, normalizeLlmModel } from "../llm.js";
import { looksLikeTruncatedModelJson } from "../api.js";
import { SOURCE_FIDELITY_RULES } from "../source-fidelity.js";
import { validateInterviewSynthesisFidelity } from "../fidelity-validation.js";
import { computeCanonicalId } from "../session-types.js";
import { concatTranscriptForSource } from "./transcript.js";

/** ~120 tokens for a single follow-up question JSON object */
const INTERVIEW_FOLLOWUP_MAX_TOKENS = 256;
/** ~80 concepts × ~80 tokens + markdown body */
const INTERVIEW_SYNTHESIS_MAX_TOKENS = 4096;

function stripJsonFence(text) {
  return String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJsonObject(text) {
  const raw = stripJsonFence(text);
  if (looksLikeTruncatedModelJson(raw)) {
    const err = new Error("Follow-up response was truncated.");
    err.code = "INTERVIEW_FOLLOWUP_TRUNCATED";
    throw err;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      const err = new Error("Follow-up response was not a JSON object.");
      err.code = "INTERVIEW_FOLLOWUP_PARSE_ERROR";
      throw err;
    }
    return parsed;
  } catch (e) {
    if (e?.code) throw e;
    const err = new Error("Could not parse follow-up JSON.");
    err.code = "INTERVIEW_FOLLOWUP_PARSE_ERROR";
    throw err;
  }
}

function classifySynthesisParseError(text, parsed) {
  const raw = String(text || "");
  if (looksLikeTruncatedModelJson(raw)) {
    const err = new Error("Synthesis response was truncated.");
    err.code = "INTERVIEW_SYNTHESIS_TRUNCATED";
    throw err;
  }
  if (parsed == null) {
    const err = new Error("Could not parse synthesis JSON.");
    err.code = "INTERVIEW_SYNTHESIS_PARSE_ERROR";
    throw err;
  }
}

function normalizeConceptRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const label = String(raw.label || raw.term || raw.name || "").trim();
    if (!label) continue;
    const canonicalId = String(raw.canonicalId || raw.id || computeCanonicalId(label)).trim();
    if (!canonicalId || seen.has(canonicalId)) continue;
    seen.add(canonicalId);
    out.push({
      canonicalId,
      label,
      definition: String(raw.definition || raw.authorUsage || "").trim(),
      detectedBy: "interview",
      importance: raw.importance != null ? Number(raw.importance) : undefined,
    });
  }
  return out;
}

/**
 * @param {{ transcript: object[], studyLang: string, llmModel?: string }} params
 */
export async function generateInterviewFollowUp({ transcript, studyLang, llmModel }) {
  const source = concatTranscriptForSource(transcript);
  const language = String(studyLang || "English").trim() || "English";
  const systemPrompt = `You are a Socratic tutor helping a learner articulate what they learned from material they cannot upload (book, lecture, film, conversation).

Rules:
- Propose exactly ONE follow-up question as JSON: {"question":"..."}
- Target gaps, unclear claims, missing examples, or real-world application — never generic restatement.
- Do NOT introduce facts the learner has not mentioned.
- Write the question in ${language}.
- Respond ONLY with valid JSON.`;

  const content = await llmChatCompletions({
    llmModel: normalizeLlmModel(llmModel),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Transcript so far:\n\n${source}\n\nReturn the next follow-up question JSON.`,
      },
    ],
    temperature: 0.5,
    max_tokens: INTERVIEW_FOLLOWUP_MAX_TOKENS,
  });

  const parsed = parseJsonObject(content);
  const question = String(parsed.question || parsed.next_question || "").trim();
  if (!question) {
    const err = new Error("Follow-up JSON missing question field.");
    err.code = "INTERVIEW_FOLLOWUP_SCHEMA_ERROR";
    throw err;
  }
  return { question };
}

/**
 * @param {{ transcript: object[], studyLang: string, sessionTitle: string, llmModel?: string, isRetry?: boolean }} params
 */
export async function synthesizeInterviewToMarkdown({
  transcript,
  studyLang,
  sessionTitle,
  llmModel,
  isRetry = false,
}) {
  const source = concatTranscriptForSource(transcript);
  const language = String(studyLang || "English").trim() || "English";
  const title = String(sessionTitle || "Interview session").trim() || "Interview session";

  const systemPrompt = `${SOURCE_FIDELITY_RULES}

You structure a learner's interview transcript into study markdown and a concept inventory.

Rules:
- Use ONLY claims present in the transcript. Never research or invent content.
- Output JSON: {"rawMarkdown":"...","concepts":[{"label":"...","definition":"...","articulatedUnprompted":true|false}]}
- rawMarkdown: clean markdown with headings; paraphrase the learner's words; no external facts.
- concepts: key ideas the learner stated; definition must trace transcript wording.
- articulatedUnprompted: true when the learner named/explained the concept without being asked directly about that label.
- Write in ${language}.
- Respond ONLY with valid JSON.`;

  const content = await llmChatCompletions({
    llmModel: normalizeLlmModel(llmModel),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({
          sessionTitle: title,
          transcript: source,
          task: "Structure transcript into rawMarkdown and concepts.",
        }),
      },
    ],
    temperature: 0.3,
    max_tokens: INTERVIEW_SYNTHESIS_MAX_TOKENS,
  });

  let parsed = null;
  try {
    parsed = JSON.parse(stripJsonFence(content));
  } catch {
    parsed = null;
  }
  classifySynthesisParseError(content, parsed);

  const rawMarkdown = String(parsed.rawMarkdown || parsed.markdown || "").trim();
  if (!rawMarkdown) {
    const err = new Error("Synthesis JSON missing rawMarkdown.");
    err.code = "INTERVIEW_SYNTHESIS_SCHEMA_ERROR";
    throw err;
  }

  const concepts = normalizeConceptRows(parsed.concepts);
  const fidelity = validateInterviewSynthesisFidelity({
    transcriptText: source,
    synthesizedMarkdown: rawMarkdown,
  });
  if (!fidelity.ok && !isRetry) {
    return synthesizeInterviewToMarkdown({
      transcript,
      studyLang,
      sessionTitle,
      llmModel,
      isRetry: true,
    });
  }
  if (!fidelity.ok) {
    const err = new Error("Synthesized content failed fidelity validation.");
    err.code = "INTERVIEW_SYNTHESIS_FIDELITY";
    throw err;
  }

  const articulatedConceptIds = [];
  const rawConcepts = Array.isArray(parsed.concepts) ? parsed.concepts : [];
  for (const raw of rawConcepts) {
    if (!raw?.articulatedUnprompted) continue;
    const label = String(raw.label || raw.term || "").trim();
    if (!label) continue;
    articulatedConceptIds.push(String(raw.canonicalId || raw.id || computeCanonicalId(label)).trim());
  }

  return { rawMarkdown, concepts, articulatedConceptIds };
}
