"use strict";
const assert = require("assert");
const h = require("../src/hypothesis");

const texts = { "a.qmd": "Merit is **widely** held [@x].\nSecond para: it’s fine.\nSecond para: again.", "b.qmd": "Other text here." };
const ann = (id, exact, text, extra) => ({ id, user: "acct:jc@hypothes.is", text, target: [{ selector: [{ type: "TextQuoteSelector", exact }] }], ...extra });

const comments = h.toComments([
	ann("1", "Merit is widely held", "cite more"),
	ann("2", "Other text", "vague"),
	ann("3", "Second para", "ambiguous"),
	ann("4", "nowhere", "lost"),
	ann("5", "it's fine", "curly quote"),
	{ id: "6", user: "acct:al@hypothes.is", text: "agree", references: ["1"], target: [] }
]);
assert.strictEqual(comments.length, 5);
assert.strictEqual(comments[0].body, "cite more | re al: agree");

const plan = h.planImport(comments, texts);
assert.deepStrictEqual(plan.edits.map(e => e.file), ["a.qmd", "a.qmd", "b.qmd"]);
assert.strictEqual(plan.edits[0].text, "{==Merit is **widely** held==}{>>jc: cite more | re al: agree<<}");
assert.strictEqual(plan.edits[1].text, "{==it’s fine==}{>>jc: curly quote<<}");
assert.deepStrictEqual(plan.unplaced.map(u => u.reason), ["quote matches 2 places", "quote not found in source"]);

// importing twice does not duplicate
const applied = { ...texts, "a.qmd": texts["a.qmd"].replace("Merit is **widely** held", plan.edits[0].text) };
assert.strictEqual(h.planImport(comments, applied).skipped, 1);

assert.deepStrictEqual(h.includesOf("x\n{{< include 01-intro.qmd >}}\n{{<include b.qmd>}}"), ["01-intro.qmd", "b.qmd"]);
console.log("hypothesis tests passed");
