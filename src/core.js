"use strict";
// CriticMarkup parsing and resolution. No dependency on the vscode API, so it can be unit-tested with plain Node.

// Optional initials tag that may follow an addition/deletion/substitution, e.g. {>>JC<<}
const TAG = String.raw`(?:\{>>[^\s:{}<]{1,8}<<\})?`;

// Alternation order matters: a highlight takes its trailing comment before a bare comment is tried.
const SOURCE =
	String.raw`\{\+\+([\s\S]*?)\+\+\}` + TAG + "|" +                       // 1: addition
	String.raw`\{--([\s\S]*?)--\}` + TAG + "|" +                           // 2: deletion
	String.raw`\{~~([\s\S]*?)~>([\s\S]*?)~~\}` + TAG + "|" +               // 3,4: substitution (old, new)
	String.raw`\{==([\s\S]*?)==\}(?:\{>>[\s\S]*?<<\})?|\{>>[\s\S]*?<<\}`;  // 5: highlight, else bare comment

function kindOf(m) {
	if (m[1] !== undefined) return "add";
	if (m[2] !== undefined) return "delete";
	if (m[3] !== undefined) return "substitute";
	if (m[5] !== undefined) return "highlight";
	return "comment";
}

/** All changes in `text`, as { start, end, kind, m } (m = the regex match). */
function findChanges(text) {
	const re = new RegExp(SOURCE, "g");
	const out = [];
	let m;
	while ((m = re.exec(text)) !== null) {
		const change = { start: m.index, end: m.index + m[0].length, kind: kindOf(m), m };
		if (change.kind === "substitute") {
			// offsets of the old and new text inside {~~old~>new~~}
			const oldStart = m.index + 3, oldEnd = oldStart + m[3].length;
			change.parts = { oldStart, oldEnd, newStart: oldEnd + 2, newEnd: oldEnd + 2 + m[4].length };
		}
		out.push(change);
		if (m[0].length === 0) re.lastIndex++;
	}
	return out;
}

/** The text a change turns into when accepted (accept = true) or rejected. */
function resolveText(change, accept) {
	const m = change.m;
	switch (change.kind) {
		case "add": return accept ? m[1] : "";
		case "delete": return accept ? "" : m[2];
		case "substitute": return accept ? m[4] : m[3];
		case "highlight": return m[5];   // keep the highlighted text, drop the comment
		default: return "";              // comment
	}
}

/** Resolve every change in `text`. */
function resolveAll(text, accept) {
	const changes = findChanges(text);
	let out = "", i = 0;
	for (const c of changes) {
		out += text.slice(i, c.start) + resolveText(c, accept);
		i = c.end;
	}
	return out + text.slice(i);
}

/** Human-readable summary of a change for the hover. */
function describe(change) {
	const m = change.m;
	const raw = m[0];
	const tag = /\{>>([^\s:{}<]{1,8})<<\}$/.exec(raw);
	const note = /\{>>(?:([^\s:{}<]{1,8}):\s*)?([\s\S]*?)<<\}$/.exec(raw);
	let title, detail = "", who = tag ? tag[1] : "", text = "";
	switch (change.kind) {
		case "add": title = "Addition"; detail = "adds: `" + m[1].trim() + "`"; break;
		case "delete": title = "Deletion"; detail = "removes: `" + m[2].trim() + "`"; break;
		case "substitute": title = "Substitution"; detail = "`" + m[3].trim() + "` → `" + m[4].trim() + "`"; break;
		case "highlight": title = "Comment on: `" + m[5].trim() + "`"; break;
		default: title = "Comment";
	}
	if ((change.kind === "highlight" || change.kind === "comment") && note) {
		who = note[1] || "";
		text = note[2].trim();
	}
	return { title, detail, who, text };
}

/** Short one-line label for lists (sidebar): { label, who }. */
function label(change) {
	const m = change.m;
	const clip = s => {
		s = s.replace(/\s+/g, " ").trim();
		return s.length > 60 ? s.slice(0, 57) + "…" : s;
	};
	const d = describe(change);
	switch (change.kind) {
		case "add": return { label: "+ " + clip(m[1]), who: d.who };
		case "delete": return { label: "− " + clip(m[2]), who: d.who };
		case "substitute": return { label: clip(m[3]) + " → " + clip(m[4]), who: d.who };
		case "highlight": return { label: clip(d.text || m[5]), who: d.who };
		default: return { label: clip(d.text), who: d.who };
	}
}

/** Snippet bodies for each insertion command; `who` must already be snippet-escaped. */
function snippetFor(kind, who) {
	switch (kind) {
		case "add": return "{++${TM_SELECTED_TEXT}$1++}{>>" + who + "<<}";
		case "delete": return "{--${TM_SELECTED_TEXT}--}{>>" + who + "<<}";
		case "substitute": return "{~~${TM_SELECTED_TEXT:$1}~>$2~~}{>>" + who + "<<}";
		default: return "{==${TM_SELECTED_TEXT:$1}==}{>>" + who + ": $2<<}"; // highlight + comment
	}
}

const escapeSnippet = s => s.replace(/[\\$}]/g, "\\$&");

module.exports = { findChanges, resolveText, resolveAll, describe, label, snippetFor, escapeSnippet };
