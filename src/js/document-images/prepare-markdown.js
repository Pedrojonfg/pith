import { PITH_IMAGE_TOKEN_RE } from "./tokens.js";
import { getDocumentImageSignedUrl } from "./storage.js";
import { replacePithImageTokens } from "./replace-tokens.js";

/**
 * @param {import("../session-types.js").DocumentImage[]} images
 */
export async function resolveImageUrls(images) {
  /** @type {Record<string, string|null>} */
  const urlById = {};
  for (const image of images || []) {
    try {
      urlById[image.imageId] = await getDocumentImageSignedUrl(image.storagePath);
    } catch {
      urlById[image.imageId] = null;
    }
  }
  return urlById;
}

/**
 * @param {string} markdown
 * @param {import("../session-types.js").DocumentImage[]} images
 */
export async function prepareMarkdownWithImages(markdown, images) {
  if (!images?.length) return String(markdown || "");
  const raw = String(markdown || "");
  const hasToken = PITH_IMAGE_TOKEN_RE.test(raw);
  PITH_IMAGE_TOKEN_RE.lastIndex = 0;
  if (!hasToken) return raw;
  const urlById = await resolveImageUrls(images);
  return replacePithImageTokens(raw, images, urlById);
}
