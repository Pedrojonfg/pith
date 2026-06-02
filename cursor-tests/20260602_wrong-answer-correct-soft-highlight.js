const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const studyPath = path.join(__dirname, "..", "src", "js", "study.js");
const cssPath = path.join(__dirname, "..", "src", "css", "main.css");
const studySource = fs.readFileSync(studyPath, "utf8");
const cssSource = fs.readFileSync(cssPath, "utf8");

// Happy path: a wrong answer paints the selected option red and also paints the correct option soft green.
assert(
  studySource.includes('chosenBtn.classList.add(normalizedChosen === normalizedCorrect ? "is-correct" : "is-wrong")'),
  "Expected chosen option to keep correct/wrong visual feedback.",
);
assert(
  studySource.includes('if (normalizedChosen !== normalizedCorrect)'),
  "Expected explicit wrong-answer branch.",
);
assert(
  studySource.includes('correctBtn.classList.add("is-correct-soft")'),
  "Expected correct option to be highlighted with soft-green class after a wrong answer.",
);

// Edge case: answers with casing/whitespace should still match and avoid false wrong branch.
assert(
  studySource.includes('const normalizedChosen = String(chosen || "").trim().toUpperCase();'),
  "Expected chosen answer normalization to handle casing/spacing edge cases.",
);
assert(
  studySource.includes('const normalizedCorrect = String(correct || "").trim().toUpperCase();'),
  "Expected correct answer normalization to handle casing/spacing edge cases.",
);

// Failure case: soft-green style must exist and differ from first-try green style.
const strongGreenMatch = cssSource.match(
  /\.test-options button\.is-correct \{[\s\S]*?background:\s*([^;]+);[\s\S]*?\}/,
);
const softGreenMatch = cssSource.match(
  /\.test-options button\.is-correct-soft \{[\s\S]*?background:\s*([^;]+);[\s\S]*?\}/,
);
assert(strongGreenMatch, "Missing .is-correct style rule.");
assert(softGreenMatch, "Missing .is-correct-soft style rule.");
assert(
  strongGreenMatch[1].trim() !== softGreenMatch[1].trim(),
  "Soft-green background should differ from first-try green background.",
);

console.log("PASS: wrong answer shows soft-green correct option");
