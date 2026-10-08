"use strict";
// Turn Hypothesis annotations into CriticMarkup comments. No dependency on the vscode API, so it can be unit-tested with plain Node.

const https = require("https");

const API = "https://api.hypothes.is/api";

function getJson(path, token, params) {
	const qs = params ? "?" + new URLSearchParams(params).toString() : "";
	return new Promise((resolve, reject) => {
		const req = https.get(API + "/" + path + qs, { headers: { Authorization: "Bearer " + token } }, res => {
			let body = "";
			res.on("data", d => (body += d));
			res.on("end", () => {
				if (res.statusCode !== 200) return reject(new Error("Hypothesis API " + res.statusCode + ": " + body.slice(0, 200)));
				try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
			});
		});
		req.on("error", reject);
	});
}

/** The groups of the user as [{ id, name }]; the public one is included (id "__world__"). */
async function listGroups(token) {
	const groups = await getJson("profile/groups", token);
	return groups.map(g => ({ id: g.id, name: g.name }));
}

/** All visible annotations of `uri`, in the group `groupId` (all the user's groups when empty). */
async function fetchAnnotations(token, uri, groupId) {
	const params = { uri, limit: 200, sort: "created", order: "asc" };
	if (groupId) params.group = groupId;
	const rows = [];
	for (;;) {
		const res = await getJson("search", token, { ...params, offset: rows.length });
		rows.push(...res.rows);
		if (!res.rows.length || rows.length >= res.total) break;
	}
	return rows.filter(a => !a.hidden);
}

const quoteOf = a => {
	for (const t of a.target || []) {
		for (const s of t.selector || []) if (s.type === "TextQuoteSelector") return s.exact;
	}
	return undefined;
};
const userOf = a => (a.user || "").replace(/^acct:/, "").split("@")[0];
const clean = s => s.replace(/\s+/g, " ").trim().replace(/<<\}/g, "< <}");

/** Top-level annotations as { id, quote, user, body }, with replies appended to their parent's body. */
function toComments(annotations) {
	const replies = {};
	for (const a of annotations) if (a.references && a.references.length) (replies[a.references[0]] = replies[a.references[0]] || []).push(a);
	return annotations.filter(a => !(a.references && a.references.length)).map(a => {
		let body = clean(a.text || "");
		for (const r of replies[a.id] || []) body += " | re " + userOf(r) + ": " + clean(r.text || "");
		return { id: a.id, quote: quoteOf(a), user: userOf(a), body };
	});
}

const QUOTES = { "'": "['‘’]", "‘": "['‘’]", "’": "['‘’]", '"': "[\"“”]", "“": "[\"“”]", "”": "[\"“”]" };

/** Match the rendered quote against markdown source: tolerate whitespace, emphasis marks, and curly quotes. */
function looseRegex(quote) {
	const sep = String.raw`(?:\s|\*|_|\\)+`;
	const word = w => [...w].map(ch => QUOTES[ch] || ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
	return new RegExp(quote.split(/\s+/).filter(Boolean).map(word).join(sep), "g");
}

/** The CriticMarkup for one comment, in the same `{>>XX: text<<}` shape the extension inserts. */
const commentMarkup = c => "{>>" + c.user + ": " + c.body + "<<}";

/**
 * Plan the edits for `comments` against `texts` ({ file: text }).
 * Returns { edits: [{ file, start, end, text }], unplaced: [{ comment, reason }], skipped } -
 * a quote must match exactly once overall; comments already present in the files are skipped.
 */
function planImport(comments, texts) {
	const all = Object.values(texts).join("\n");
	const byRange = new Map(), unplaced = [];
	let skipped = 0;
	for (const c of comments) {
		if (all.includes(commentMarkup(c))) { skipped++; continue; }
		if (!c.quote || !c.quote.trim()) { unplaced.push({ comment: c, reason: "page-level note (no quoted text)" }); continue; }
		const hits = [];
		for (const [file, t] of Object.entries(texts)) {
			for (const m of t.matchAll(looseRegex(c.quote))) hits.push({ file, start: m.index, end: m.index + m[0].length });
		}
		if (hits.length !== 1) { unplaced.push({ comment: c, reason: hits.length ? "quote matches " + hits.length + " places" : "quote not found in source" }); continue; }
		const h = hits[0], key = h.file + ":" + h.start + ":" + h.end;
		if (!byRange.has(key)) byRange.set(key, { ...h, comments: [] });
		byRange.get(key).comments.push(c);
	}
	// drop ranges that overlap an earlier one in the same file
	const edits = [];
	for (const r of [...byRange.values()].sort((a, b) => a.file.localeCompare(b.file) || a.start - b.start)) {
		const prev = edits[edits.length - 1];
		if (prev && prev.file === r.file && r.start < prev.end) {
			for (const c of r.comments) unplaced.push({ comment: c, reason: "overlaps another annotation" });
			continue;
		}
		const quoted = texts[r.file].slice(r.start, r.end);
		edits.push({ file: r.file, start: r.start, end: r.end, text: "{==" + quoted + "==}" + r.comments.map(commentMarkup).join("") });
	}
	const placed = edits.reduce((n, e) => n + (e.text.match(/\{>>/g) || []).length, 0);
	return { edits, unplaced, skipped, placed };
}

/** Files pulled in with {{< include file.qmd >}} in `text`. */
const includesOf = text => [...text.matchAll(/\{\{<\s*include\s+(\S+?)\s*>\}\}/g)].map(m => m[1]);

module.exports = { listGroups, fetchAnnotations, toComments, planImport, looseRegex, includesOf, commentMarkup };
