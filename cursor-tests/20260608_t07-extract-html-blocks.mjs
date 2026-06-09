import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { extractHtmlBlocks } from "../src/js/normalization/extract-html-blocks.js";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;

function testWordHeading1() {
  const html = `<html><body><p class="Heading1">Capítulo 1</p><p>Texto del cuerpo.</p></body></html>`;
  const blocks = extractHtmlBlocks(html);
  const heading = blocks.find((b) => b.kind === "heading");
  assert.ok(heading, "expected heading block");
  assert.match(heading.text, /Capítulo 1/);
}

function testNativeH2() {
  const html = `<html><body><h2>Section</h2><p>Body</p></body></html>`;
  const blocks = extractHtmlBlocks(html);
  const h2 = blocks.find((b) => b.kind === "heading");
  assert.ok(h2);
  assert.equal(h2.lineIndex, 2);
}

function testParagraphBody() {
  const html = `<html><body><p>Only paragraph</p></body></html>`;
  const blocks = extractHtmlBlocks(html);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, "paragraph");
}

testWordHeading1();
testNativeH2();
testParagraphBody();

console.log("20260608_t07-extract-html-blocks: all tests passed");
