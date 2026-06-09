/**
 * T06 — resolveSidebarOpen desktop default
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260533_t03-sidebar-default.mjs
 */
import assert from "node:assert/strict";
import { resolveSidebarOpen } from "../src/js/slow/sidebar.js";

const originalMatchMedia = globalThis.window?.matchMedia;

function withMatchMedia(matches, fn) {
  globalThis.window = globalThis.window || {};
  globalThis.window.matchMedia = (query) => ({
    matches,
    media: query,
    addListener: () => {},
    removeListener: () => {},
  });
  try {
    fn();
  } finally {
    if (originalMatchMedia) globalThis.window.matchMedia = originalMatchMedia;
    else delete globalThis.window.matchMedia;
  }
}

function testDesktopDefaultClosedHappyPath() {
  withMatchMedia(true, () => {
    const session = { slow: {} };
    assert.equal(resolveSidebarOpen(session), false);
  });
}

function testMobileDefaultOpenEdge() {
  withMatchMedia(false, () => {
    const session = { slow: {} };
    assert.equal(resolveSidebarOpen(session), true);
  });
}

function testExplicitPersistedFailureOverride() {
  withMatchMedia(true, () => {
    assert.equal(resolveSidebarOpen({ slow: { sidebarOpen: true } }), true);
    assert.equal(resolveSidebarOpen({ slow: { sidebarOpen: false } }), false);
  });
}

testDesktopDefaultClosedHappyPath();
testMobileDefaultOpenEdge();
testExplicitPersistedFailureOverride();
console.log("20260533_t03-sidebar-default: all passed");
