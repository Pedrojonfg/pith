/**
 * T17 — Guide sidebar chat cleared on new session boundaries
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260526_t17-guide-chat-clear.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import { clearGuideChatStorage } from "../src/js/guide-chat.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

resetStorage();
localStorage.setItem("guide_chat_unknown_session", JSON.stringify([{ role: "user", content: "stale" }]));
localStorage.setItem("guide_chat_sess_old", JSON.stringify([{ role: "user", content: "old" }]));
localStorage.setItem("pending_comment", JSON.stringify({ text: "wait", blockIndex: 0 }));
window.guideHistory = [{ role: "user", content: "mem" }];

clearGuideChatStorage({ removeAllStored: true });

assert(window.guideHistory.length === 0, "in-memory guideHistory cleared");
assert(window.pendingComment == null, "pendingComment cleared");
assert(!localStorage.getItem("pending_comment"), "pending_comment key removed");
assert(!localStorage.getItem("guide_chat_unknown_session"), "all guide_chat_* keys removed");
assert(!localStorage.getItem("guide_chat_sess_old"), "other session chat keys removed");

console.log(`\nT17 guide chat clear: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
