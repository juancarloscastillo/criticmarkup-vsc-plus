"use strict";
const assert = require("assert");
const core = require("../src/core");

const text = "A {++new ++}{>>JC<<}b {--old--}{>>JC<<}c {~~x~>y~~}{>>AL<<} {==hl==}{>>JC: why<<} {>>MR: note<<}.";

assert.deepStrictEqual(core.findChanges(text).map(c => c.kind),
	["add", "delete", "substitute", "highlight", "comment"]);
assert.strictEqual(core.resolveAll(text, true), "A new b c y hl .");
assert.strictEqual(core.resolveAll(text, false), "A b oldc x hl .");

// untagged markup (written by hand) still resolves
assert.strictEqual(core.resolveAll("a{++b++}c{--d--}e", true), "abce");
assert.strictEqual(core.resolveAll("a{++b++}c{--d--}e", false), "acde");

// multi-line change
assert.strictEqual(core.resolveAll("x {--line one\nline two--}{>>JC<<} y", true), "x  y");

// a real comment after a change is NOT swallowed as an initials tag
assert.strictEqual(core.resolveAll("{++a++}{>>JC: please check<<}", true), "a");
assert.deepStrictEqual(core.findChanges("{++a++}{>>JC: please check<<}").map(c => c.kind), ["add", "comment"]);

// substitution part offsets
const subText = "pre {~~old words~>new words~~}{>>JC<<} post";
const [subChange] = core.findChanges(subText);
const P = subChange.parts;
assert.strictEqual(subText.slice(P.oldStart, P.oldEnd), "old words");
assert.strictEqual(subText.slice(P.newStart, P.newEnd), "new words");

// hover descriptions
const [add, , sub, hl] = core.findChanges(text);
assert.deepStrictEqual(core.describe(add), { title: "Addition", detail: "adds: `new`", who: "JC", text: "" });
assert.strictEqual(core.describe(sub).detail, "`x` → `y`");
assert.deepStrictEqual([core.describe(hl).who, core.describe(hl).text], ["JC", "why"]);

// sidebar labels
assert.deepStrictEqual(core.label(add), { label: "+ new", who: "JC" });
assert.strictEqual(core.label(sub).label, "x → y");
assert.deepStrictEqual(core.label(hl), { label: "why", who: "JC" });

// snippets
assert.strictEqual(core.snippetFor("add", "JC"), "{++${TM_SELECTED_TEXT}$1++}{>>JC<<}");
assert.strictEqual(core.snippetFor("highlight", "JC"), "{==${TM_SELECTED_TEXT:$1}==}{>>JC: $2<<}");
assert.strictEqual(core.escapeSnippet("a$b}"), "a\\$b\\}");

console.log("core tests passed");
