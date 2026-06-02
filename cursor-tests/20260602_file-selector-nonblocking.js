const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const studyPath = path.join(__dirname, "..", "src", "js", "study.js");
const source = fs.readFileSync(studyPath, "utf8");

const changeAnchor = 'els.fileInput.addEventListener("change", async () => {';
const changeStart = source.indexOf(changeAnchor);
assert(changeStart !== -1, "Could not find file input change handler.");

const changeEnd = source.indexOf("enableUnifiedMaterialUpload();", changeStart);
assert(changeEnd !== -1, "Could not find end of file input change section.");

const changeBlock = source.slice(changeStart, changeEnd);
assert(
  !changeBlock.includes("readAndCleanMaterialText(file)"),
  "Change handler should not run heavy extraction.",
);
assert(
  changeBlock.includes("file.slice(0, 64 * 1024).text()"),
  "Change handler should only probe a small chunk.",
);
assert(
  changeBlock.includes("await loadOfflinePack(rawMaterialText"),
  "Offline pack path should still auto-load.",
);

const submitAnchor = 'els.generateBlocksForm.addEventListener("submit", async (e) => {';
const submitStart = source.indexOf(submitAnchor);
assert(submitStart !== -1, "Could not find generate form submit handler.");
const submitEnd = source.indexOf("els.confirmBlocksBtn.addEventListener", submitStart);
assert(submitEnd !== -1, "Could not find end of submit handler section.");
const submitBlock = source.slice(submitStart, submitEnd);
assert(
  submitBlock.includes("readAndCleanMaterialText(file)"),
  "Submit handler should still run extraction before generation.",
);

console.log("PASS: file selector non-blocking validation");
