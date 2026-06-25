/**
 * Book metadata lookup for book-enriched nodoc sessions (20260622-book-enriched-nodoc).
 * Client-side cascade: Open Library → Google Books → Wikipedia. Global Supabase cache.
 */

import { supabase } from "./supabase-client.js";
import { getSupabaseAuthToken } from "./llm.js?v=20260625_02";
import { SUPABASE_URL } from "./config/supabase.js";
import {
  BOOK_LOOKUP_FLAGS as FLAGS,
} from "./config/flags.js";

export const COVERAGE_LEVELS = Object.freeze({ A: "A", B: "B", C: "C" });

const BOOKS_PROXY_URL = `${SUPABASE_URL}/functions/v1/books-proxy`;

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * @param {string} title
 * @param {string} [author]
 */
export function buildCacheKey(title, author) {
  const normalize = (s) =>
    String(s || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_");
  const t = normalize(title);
  const a = normalize(author);
  return a ? `${t}__${a}` : t;
}

/**
 * @param {Record<string, string>} queryParams
 */
async function fetchBooksViaProxy(queryParams) {
  const token = await getSupabaseAuthToken();
  if (!token) return null;

  const params = new URLSearchParams(queryParams);
  const res = await fetch(`${BOOKS_PROXY_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  return res.json();
}

/**
 * @param {string} url
 * @param {number} [ms]
 */
async function fetchWithTimeout(url, ms = FLAGS.BOOK_LOOKUP_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * @param {string} url
 */
async function verifyCoverUrl(url) {
  const base = {
    coverUrlVerified: false,
    coverMimeType: null,
    coverFormatSupported: false,
    coverSizeBytes: null,
    coverSizeOk: false,
  };
  const raw = String(url || "").trim();
  if (!raw) return base;
  try {
    const res = await fetchWithTimeout(raw, FLAGS.BOOK_LOOKUP_TIMEOUT_MS);
    if (!res.ok) return base;
    const mime = String(res.headers.get("Content-Type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const lenRaw = res.headers.get("Content-Length");
    const sizeBytes = lenRaw != null ? Number(lenRaw) : null;
    const formatOk = SUPPORTED_IMAGE_TYPES.has(mime);
    const sizeOk =
      sizeBytes == null || !Number.isFinite(sizeBytes)
        ? true
        : sizeBytes <= FLAGS.MAX_COVER_SIZE_BYTES;
    return {
      coverUrlVerified: true,
      coverMimeType: mime || null,
      coverFormatSupported: formatOk,
      coverSizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
      coverSizeOk: formatOk && sizeOk,
    };
  } catch {
    return base;
  }
}

/**
 * @param {object} row
 * @param {string} userTitle
 * @param {string} userAuthor
 */
function rowToBookMeta(row, userTitle, userAuthor) {
  const coverUrl = row?.cover_url ? String(row.cover_url) : null;
  return {
    title: userTitle,
    author: userAuthor,
    coverUrl,
    coverUrlVerified: Boolean(coverUrl),
    coverLoadFailed: false,
    coverMimeType: null,
    coverFormatSupported: Boolean(coverUrl),
    coverSizeBytes: null,
    coverSizeOk: Boolean(coverUrl),
    level: /** @type {'A'|'B'|'C'} */ (String(row?.coverage_level || "C")),
    toc: Array.isArray(row?.toc) ? row.toc : null,
    description: row?.description ? String(row.description) : null,
    cachedAt: row?.searched_at ? Date.parse(row.searched_at) || Date.now() : Date.now(),
  };
}

/**
 * @param {string} cacheKey
 */
async function readCache(cacheKey) {
  try {
    const { data, error } = await supabase
      .from("pith_book_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * @param {object} payload
 */
async function writeCache(payload) {
  try {
    await supabase.from("pith_book_cache").upsert(payload, { onConflict: "cache_key" });
  } catch {
    // non-blocking per spec
  }
}

/**
 * @param {unknown} raw
 */
function normalizeTocEntries(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const title = String(item.title || "").trim();
    if (!title) continue;
    const number = item.number != null ? String(item.number).trim() : undefined;
    out.push(number ? { number, title } : { title });
  }
  return out;
}

/**
 * @param {string} title
 * @param {string} author
 */
async function fetchOpenLibrary(title, author) {
  const params = new URLSearchParams({
    title,
    limit: "3",
    fields: "key,title,author_name,cover_i",
  });
  if (author) params.set("author", author);
  const res = await fetchWithTimeout(
    `https://openlibrary.org/search.json?${params.toString()}`,
  );
  if (!res.ok) return null;
  const json = await res.json();
  const doc = Array.isArray(json?.docs) ? json.docs[0] : null;
  if (!doc?.key) return null;

  const workId = String(doc.key).replace(/^\/works\//, "");
  const editionsRes = await fetchWithTimeout(
    `https://openlibrary.org/works/${encodeURIComponent(workId)}/editions.json?limit=5`,
  );
  let toc = [];
  if (editionsRes.ok) {
    const editions = await editionsRes.json();
    const entries = Array.isArray(editions?.entries) ? editions.entries : [];
    for (const ed of entries) {
      const candidate = normalizeTocEntries(ed?.table_of_contents);
      if (candidate.length >= FLAGS.BOOK_TOC_MIN_ENTRIES) {
        toc = candidate;
        break;
      }
    }
  }

  const cover_i = doc.cover_i;
  const coverUrl =
    cover_i != null
      ? `https://covers.openlibrary.org/b/id/${cover_i}-M.jpg`
      : null;
  const resolvedTitle = String(doc.title || title).trim();
  const resolvedAuthor = Array.isArray(doc.author_name)
    ? String(doc.author_name[0] || author).trim()
    : author;

  return {
    resolvedTitle,
    resolvedAuthor,
    toc,
    coverUrl,
    level: toc.length >= FLAGS.BOOK_TOC_MIN_ENTRIES ? "A" : null,
  };
}

/**
 * @param {string} title
 * @param {string} author
 */
async function fetchGoogleBooks(title, author) {
  const q = `${title} ${author}`.trim();
  const json = await fetchBooksViaProxy({ q, maxResults: "1" });
  if (!json) return null;
  const item = Array.isArray(json?.items) ? json.items[0] : null;
  const vi = item?.volumeInfo;
  if (!vi) return null;
  const description = String(vi.description || "").trim();
  let coverUrl = vi?.imageLinks?.thumbnail
    ? String(vi.imageLinks.thumbnail).replace(/&edge=curl/g, "")
    : null;
  return {
    resolvedTitle: String(vi.title || title).trim(),
    resolvedAuthor: Array.isArray(vi.authors) ? String(vi.authors[0] || author).trim() : author,
    description: description.length >= FLAGS.BOOK_DESCRIPTION_MIN_CHARS ? description : null,
    coverUrl,
  };
}

/**
 * @param {string} title
 */
async function fetchWikipedia(title) {
  const slug = encodeURIComponent(title.replace(/\s+/g, "_"));
  const res = await fetchWithTimeout(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`,
  );
  if (!res.ok) return null;
  const json = await res.json();
  const extract = String(json?.extract || "").trim();
  if (extract.length < FLAGS.BOOK_DESCRIPTION_MIN_CHARS) return null;
  return { description: extract };
}

/**
 * @param {string} title
 * @param {string} [author]
 * @returns {Promise<import('./session-types.js').BookMeta>}
 */
export async function lookupBook(title, author = "") {
  const userTitle = String(title || "").trim();
  const userAuthor = String(author || "").trim();
  if (!userTitle) {
    throw new Error("Book title is required.");
  }

  const cacheKey = buildCacheKey(userTitle, userAuthor);
  const cached = await readCache(cacheKey);
  if (cached) {
    return rowToBookMeta(cached, userTitle, userAuthor);
  }

  let level = /** @type {'A'|'B'|'C'} */ ("C");
  let toc = null;
  let description = null;
  let coverUrl = null;
  let resolvedTitle = userTitle;
  let resolvedAuthor = userAuthor;

  try {
    const ol = await fetchOpenLibrary(userTitle, userAuthor);
    if (ol) {
      resolvedTitle = ol.resolvedTitle || userTitle;
      resolvedAuthor = ol.resolvedAuthor || userAuthor;
      if (ol.coverUrl) coverUrl = ol.coverUrl;
      if (ol.level === "A" && ol.toc?.length >= FLAGS.BOOK_TOC_MIN_ENTRIES) {
        level = "A";
        toc = ol.toc;
      }
    }
  } catch {
    // skip
  }

  if (level !== "A") {
    try {
      const gb = await fetchGoogleBooks(userTitle, userAuthor);
      if (gb) {
        if (gb.resolvedTitle) resolvedTitle = gb.resolvedTitle;
        if (gb.resolvedAuthor) resolvedAuthor = gb.resolvedAuthor;
        if (!coverUrl && gb.coverUrl) coverUrl = gb.coverUrl;
        if (gb.description) {
          level = "B";
          description = gb.description;
        }
      }
    } catch {
      // skip
    }
  }

  if (level === "C") {
    try {
      const wiki = await fetchWikipedia(userTitle);
      if (wiki?.description) {
        level = "B";
        description = wiki.description;
      }
    } catch {
      // skip
    }
  }

  let coverMeta = {
    coverUrlVerified: false,
    coverMimeType: null,
    coverFormatSupported: false,
    coverSizeBytes: null,
    coverSizeOk: false,
  };
  let verifiedCoverUrl = null;
  if (coverUrl) {
    coverMeta = await verifyCoverUrl(coverUrl);
    if (coverMeta.coverUrlVerified && coverMeta.coverFormatSupported && coverMeta.coverSizeOk) {
      verifiedCoverUrl = coverUrl;
    }
  }

  const now = Date.now();
  const bookMeta = {
    title: userTitle,
    author: userAuthor,
    coverUrl: verifiedCoverUrl,
    coverLoadFailed: false,
    ...coverMeta,
    level,
    toc,
    description,
    cachedAt: now,
  };

  void writeCache({
    cache_key: cacheKey,
    title: resolvedTitle,
    author: resolvedAuthor || null,
    coverage_level: level,
    toc,
    description,
    cover_url: verifiedCoverUrl,
    searched_at: new Date(now).toISOString(),
  });

  return bookMeta;
}

/** @typedef {import('./session-types.js').BookMeta} BookMeta */
