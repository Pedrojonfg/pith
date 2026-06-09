/**
 * Shared pdf.js dynamic loader (CDN).
 */

const PDFJS_VERSION = "4.4.168";
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

let pdfjsModulePromise = null;

export async function loadPdfJs() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import(`${PDFJS_BASE}/pdf.min.mjs`).then((mod) => {
      const pdfjs = mod.default ?? mod;
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsModulePromise;
}
