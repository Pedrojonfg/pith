import { supabase } from "../supabase-client.js";
import { getAuthUserId } from "../session-persist-supabase.js";

export const DOCUMENT_IMAGES_BUCKET = "document-images";

/**
 * @param {string} userId
 * @param {string} docId
 * @param {string} imageId
 * @param {string} ext
 */
export function documentImageStoragePath(userId, docId, imageId, ext) {
  const safeExt = String(ext || "png").replace(/^\./, "").toLowerCase();
  return `${userId}/${docId}/${imageId}.${safeExt}`;
}

/** @param {string} mimeType */
export function mimeToExt(mimeType) {
  const m = String(mimeType || "").toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "png";
}

/**
 * @param {string} userId
 * @param {string} docId
 * @param {string} imageId
 * @param {ArrayBuffer|Blob|Uint8Array} bytes
 * @param {string} mimeType
 */
export async function uploadDocumentImage(userId, docId, imageId, bytes, mimeType) {
  const ext = mimeToExt(mimeType);
  const path = documentImageStoragePath(userId, docId, imageId, ext);
  const blob =
    bytes instanceof Blob
      ? bytes
      : new Blob([bytes], { type: mimeType || "image/png" });
  const { error } = await supabase.storage.from(DOCUMENT_IMAGES_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: mimeType || "image/png",
  });
  if (error) throw error;
  return path;
}

/**
 * @param {string} storagePath
 * @param {number} [expiresIn]
 */
export async function getDocumentImageSignedUrl(storagePath, expiresIn = 3600) {
  const path = String(storagePath || "").trim();
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(DOCUMENT_IMAGES_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

/**
 * @typedef {object} PendingDocumentImage
 * @property {string} imageId
 * @property {"embedded"|"full_page_fallback"} sourceType
 * @property {"pdf"|"html"} sourceFormat
 * @property {number|null} pageNumber
 * @property {ArrayBuffer|Blob|Uint8Array} bytes
 * @property {string} mimeType
 * @property {number|null} [width]
 * @property {number|null} [height]
 */

/**
 * @param {string} docId
 * @param {PendingDocumentImage[]} pendingImages
 */
export async function persistPendingImages(docId, pendingImages) {
  const userId = await getAuthUserId();
  const now = Date.now();
  /** @type {import("../session-types.js").DocumentImage[]} */
  const records = [];
  for (const item of pendingImages || []) {
    const path = await uploadDocumentImage(
      userId,
      docId,
      item.imageId,
      item.bytes,
      item.mimeType,
    );
    records.push({
      imageId: item.imageId,
      sourceType: item.sourceType,
      sourceFormat: item.sourceFormat,
      pageNumber: item.pageNumber ?? null,
      storagePath: path,
      width: item.width ?? null,
      height: item.height ?? null,
      mimeType: item.mimeType || "image/png",
      createdAt: now,
      visionStatus: "pending",
      visionDescription: null,
      conceptLinks: [],
    });
  }
  return records;
}
