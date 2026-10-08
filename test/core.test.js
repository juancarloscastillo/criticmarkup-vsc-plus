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

// reviewer mode: trackEdit
{
	const apply = (oldText, ch, who, back) => {
		const after = oldText.slice(0, ch.start) + ch.text + oldText.slice(ch.end);
		const r = core.trackEdit(oldText, ch, who, back);
		if (!r) return { text: after, cursor: null };
		return { text: after.slice(0, r.start) + r.text + after.slice(r.end), cursor: r.cursor };
	};
	const T = "{>>JC<<}";
	// typing a character wraps it, cursor lands inside before ++}
	let r = apply("ab cd", { start: 2, end: 2, text: "X" }, "JC");
	assert.strictEqual(r.text, "ab{++X++}" + T + " cd");
	assert.strictEqual(r.text.slice(r.cursor), "++}" + T + " cd");
	// typing inside an addition is left alone
	assert.strictEqual(core.trackEdit("ab{++X++}" + T, { start: 6, end: 6, text: "Y" }, "JC"), null);
	// deleting text keeps it as a deletion (Delete key: cursor after the block)
	r = apply("ab cd", { start: 2, end: 3, text: "" }, "JC", false);
	assert.strictEqual(r.text, "ab{-- --}" + T + "cd");
	assert.strictEqual(r.cursor, 2 + "{-- --}".length + T.length);
	// Backspace chain merges deletions: delete "d" then "c" before it
	let t = "ab cd";
	r = apply(t, { start: 4, end: 5, text: "" }, "JC", true);   // backspace the d
	assert.strictEqual(r.text, "ab c{--d--}" + T);
	r = apply(r.text, { start: 3, end: 4, text: "" }, "JC", true); // backspace the c
	assert.strictEqual(r.text, "ab {--cd--}" + T);
	// Delete chain merges too
	r = apply("ab cd", { start: 3, end: 4, text: "" }, "JC", false);
	r = apply(r.text, { start: 3 + "{--c--}".length + T.length, end: 3 + "{--c--}".length + T.length + 1, text: "" }, "JC", false);
	assert.strictEqual(r.text, "ab {--cd--}" + T);
	// typing over a selection is a substitution
	r = apply("ab cd", { start: 3, end: 5, text: "Z" }, "JC");
	assert.strictEqual(r.text, "ab {~~cd~>Z~~}" + T);
	assert.strictEqual(r.text.slice(r.cursor), "~~}" + T);
	// deleting a delimiter is undone; our own markup is never re-wrapped
	const doc = "a{++b++}" + T;
	r = apply(doc, { start: 1, end: 2, text: "" }, "JC", true);
	assert.strictEqual(r.text, doc);
	assert.strictEqual(core.trackEdit("ab", { start: 1, end: 1, text: "{++x++}" }, "JC"), null);
}
