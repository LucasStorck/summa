import {test} from "node:test";
import {canonicalizeUrl} from "./canonicalizeUrl.js";
import assert from "node:assert/strict";

test("removes tracking parameters and prefixes from URL", () => {
    assert.strictEqual(
    canonicalizeUrl("https://www.bbc.com/portuguese/articles/abc?at_medium=RSS&at_campaign=rss"),
    "https://www.bbc.com/portuguese/articles/abc",
    );
});

test("removes DW feed tracking parameter", () => {
    assert.strictEqual(
    canonicalizeUrl("https://www.dw.com/pt-br/materia/a-79870019?maca=bra-rss-br-all-1030-xml-mrss"),
    "https://www.dw.com/pt-br/materia/a-79870019",
    );
});

test("throws error for invalid URL", () => {
    assert.throws(() => canonicalizeUrl("not a url"), TypeError);
});

test("removes hash fragment from URL", () => {
    assert.strictEqual(
    canonicalizeUrl("https://www.bbc.com/portuguese/articles/abc#section1"),
    "https://www.bbc.com/portuguese/articles/abc",
    );
});

test("removes only utm_ prefix parameters and keeps other parameters", () => {
    assert.strictEqual(
    canonicalizeUrl("https://www.bbc.com/portuguese/articles/abc?utm_source=google&param1=value1"),
    "https://www.bbc.com/portuguese/articles/abc?param1=value1",
    );
});

test("removes case-insensitive tracking parameters and prefixes", () => {
    assert.strictEqual(
    canonicalizeUrl("https://www.bbc.com/portuguese/articles/abc?UTM_SOURCE=google&At_Medium=RSS"),
    "https://www.bbc.com/portuguese/articles/abc",
    );
});

test("clean URL with no tracking parameters remains unchanged", () => {
    assert.strictEqual(
    canonicalizeUrl("https://www.bbc.com/portuguese/articles/abc?param1=value1&param2=value2"),
    "https://www.bbc.com/portuguese/articles/abc?param1=value1&param2=value2",
    );
});

test("keeps legitimate parameter that looks like tracking", () => {
  assert.strictEqual(
    canonicalizeUrl("https://example.com/a?at_page=2"),
    "https://example.com/a?at_page=2",
  );
});

test("same URL with different tracking parameters results in the same canonical URL", () => {
  assert.equal(
    canonicalizeUrl("https://x.com/busca?q=a%20b&utm_source=tw"),
    canonicalizeUrl("https://x.com/busca?q=a%20b"),
  );
});