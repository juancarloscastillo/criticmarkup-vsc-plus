"use strict";
const vscode = require("vscode");
const cp = require("child_process");
const path = require("path");
const core = require("./core");
const hypothesis = require("./hypothesis");

const LANGS = ["quarto", "markdown", "rmd"];
const INITIALS_KEY = "criticmarkup.initials";
const isSupported = doc => LANGS.includes(doc.languageId);

const rangeOf = (doc, c) => new vscode.Range(doc.positionAt(c.start), doc.positionAt(c.end));

// ---------------------------------------------------------------- initials

function gitInitials(cwd) {
	try {
		const name = cp.execSync("git config user.name", { cwd, encoding: "utf8" }).trim();
		return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 4);
	} catch (e) {
		return "";
	}
}

async function getInitials(context, force) {
	let initials = context.workspaceState.get(INITIALS_KEY);
	if (initials && !force) return initials;
	const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
	const input = await vscode.window.showInputBox({
		prompt: "Your initials for CriticMarkup changes and comments (asked once per workspace)",
		value: initials || (folder ? gitInitials(folder.uri.fsPath) : ""),
		validateInput: v => (v.trim() ? null : "Enter your initials")
	});
	if (!input) return undefined;
	initials = input.trim();
	await context.workspaceState.update(INITIALS_KEY, initials);
	return initials;
}

// ---------------------------------------------------------------- commands

async function insert(context, kind) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;
	const initials = await getInitials(context);
	if (!initials) return;
	await editor.insertSnippet(new vscode.SnippetString(core.snippetFor(kind, core.escapeSnippet(initials))));
}

/** Accept/reject the change under the cursor, the changes in the selection, or all of them. */
async function resolveCommand(accept, scope) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;
	const doc = editor.document;
	const all = core.findChanges(doc.getText());
	let chosen = all;
	if (scope !== "all") {
		const sel = editor.selection;
		const s = doc.offsetAt(sel.start), e = doc.offsetAt(sel.end);
		chosen = sel.isEmpty
			? all.filter(c => c.start <= s && s <= c.end).slice(0, 1)
			: all.filter(c => c.start < e && c.end > s);
	}
	if (!chosen.length) {
		vscode.window.showInformationMessage("CriticMarkup: no change at the cursor or selection.");
		return;
	}
	if (scope === "all") {
		const ok = await vscode.window.showWarningMessage(
			(accept ? "Accept" : "Reject") + " all " + chosen.length + " changes in this document?", { modal: true }, "Yes");
		if (ok !== "Yes") return;
	}
	await editor.edit(eb => chosen.forEach(c => eb.replace(rangeOf(doc, c), core.resolveText(c, accept))));
}

async function resolveAt(offset, accept) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;
	const c = core.findChanges(editor.document.getText()).find(x => x.start === offset);
	if (!c) return;
	await editor.edit(eb => eb.replace(rangeOf(editor.document, c), core.resolveText(c, accept)));
}

/** Select the next/previous change (including its initials tag), wrapping around. */
function go(forward) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;
	const doc = editor.document;
	const all = core.findChanges(doc.getText());
	if (!all.length) {
		vscode.window.showInformationMessage("CriticMarkup: no changes in this document.");
		return;
	}
	const from = doc.offsetAt(editor.selection.start);
	const target = forward
		? all.find(c => c.start > from) || all[0]
		: [...all].reverse().find(c => c.start < from) || all[all.length - 1];
	editor.selection = new vscode.Selection(doc.positionAt(target.start), doc.positionAt(target.end));
	editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/** Copy the bundled Quarto filter next to the active document (or into the workspace root). */
async function installFilter(context) {
	const editor = vscode.window.activeTextEditor;
	let dir;
	if (editor && editor.document.uri.scheme === "file") {
		dir = vscode.Uri.joinPath(editor.document.uri, "..");
	} else if (vscode.workspace.workspaceFolders) {
		dir = vscode.workspace.workspaceFolders[0].uri;
	} else {
		vscode.window.showErrorMessage("CriticMarkup: open a Quarto document or folder first.");
		return;
	}
	const target = vscode.Uri.joinPath(dir, "criticmarkup.lua");
	try {
		await vscode.workspace.fs.stat(target);
		const ok = await vscode.window.showWarningMessage(
			"criticmarkup.lua already exists here. Overwrite it?", { modal: true }, "Overwrite");
		if (ok !== "Overwrite") return;
	} catch (e) { /* does not exist yet */ }
	const src = vscode.Uri.joinPath(context.extensionUri, "filters", "criticmarkup.lua");
	await vscode.workspace.fs.copy(src, target, { overwrite: true });
	const yaml = "format:\n  html:\n    filters:\n      - criticmarkup.lua";
	const pick = await vscode.window.showInformationMessage(
		"Copied criticmarkup.lua. Add a `filters` entry under the html format in your YAML.", "Copy YAML snippet");
	if (pick) await vscode.env.clipboard.writeText(yaml);
}

// ---------------------------------------------------------------- highlighting

// Text colours per kind (light / dark theme); the background is shared and configurable.
// Later entries are drawn over earlier ones. substituteOld/New recolour the two halves of {~~old~>new~~}.
const COLORS = {
	add: { light: "#1a7f1a", dark: "#5fd35f" },
	delete: { light: "#c62828", dark: "#ff7b7b" },
	substitute: { light: "#a85a00", dark: "#f0a050" },
	highlight: { light: "#7a3a7a", dark: "#d8a0d8" },
	comment: { light: "#2b5fb4", dark: "#7fb0ff" },
	substituteOld: { light: "#c62828", dark: "#ff7b7b", overlay: true, strike: true },
	substituteNew: { light: "#1a7f1a", dark: "#5fd35f", overlay: true }
};

let decorations = {};

function makeDecorations() {
	Object.values(decorations).forEach(d => d.dispose());
	decorations = {};
	const bg = vscode.workspace.getConfiguration("criticmarkup").get("background");
	for (const [kind, c] of Object.entries(COLORS)) {
		decorations[kind] = vscode.window.createTextEditorDecorationType({
			...(bg && !c.overlay ? { backgroundColor: bg } : {}),
			...(c.strike ? { textDecoration: "line-through" } : {}),
			borderRadius: "3px",
			light: { color: c.light },
			dark: { color: c.dark }
		});
	}
}

function paint(editor) {
	if (!editor || !isSupported(editor.document)) return;
	const doc = editor.document;
	const byKind = Object.fromEntries(Object.keys(COLORS).map(k => [k, []]));
	const span = (a, b) => new vscode.Range(doc.positionAt(a), doc.positionAt(b));
	for (const c of core.findChanges(doc.getText())) {
		byKind[c.kind].push(rangeOf(doc, c));
		if (c.parts) {
			byKind.substituteOld.push(span(c.parts.oldStart, c.parts.oldEnd));
			byKind.substituteNew.push(span(c.parts.newStart, c.parts.newEnd));
		}
	}
	for (const [kind, ranges] of Object.entries(byKind)) editor.setDecorations(decorations[kind], ranges);
}

const paintAll = () => vscode.window.visibleTextEditors.forEach(paint);

// ---------------------------------------------------------------- hover

function hoverFor(doc, pos) {
	const offset = doc.offsetAt(pos);
	const c = core.findChanges(doc.getText()).find(x => x.start <= offset && offset <= x.end);
	if (!c) return undefined;
	const d = core.describe(c);
	const arg = encodeURIComponent(JSON.stringify([c.start]));
	const md = new vscode.MarkdownString(undefined, true);
	md.isTrusted = { enabledCommands: ["criticmarkup.acceptAt", "criticmarkup.rejectAt"] };
	md.appendMarkdown("**" + d.title + "**" + (d.who ? " · " + d.who : "") + "\n\n");
	if (d.detail) md.appendMarkdown(d.detail + "\n\n");
	if (d.text) md.appendMarkdown("> " + d.text.replace(/\n/g, "\n> ") + "\n\n");
	md.appendMarkdown("[$(check) Accept](command:criticmarkup.acceptAt?" + arg + ")  &nbsp;|&nbsp;  "
		+ "[$(close) Reject](command:criticmarkup.rejectAt?" + arg + ")");
	return new vscode.Hover(md, rangeOf(doc, c));
}

// ---------------------------------------------------------------- menu, status bar, sidebar

const MENU = [
	{ label: "$(add) Add text", description: "Ctrl+K A", command: "criticmarkup.add" },
	{ label: "$(trash) Delete selection", description: "Ctrl+K D", command: "criticmarkup.delete" },
	{ label: "$(replace) Substitute selection", description: "Ctrl+K X", command: "criticmarkup.substitute" },
	{ label: "$(comment) Comment on selection", description: "Ctrl+K C", command: "criticmarkup.highlight" },
	{ kind: vscode.QuickPickItemKind.Separator, label: "Review" },
	{ label: "$(arrow-down) Next change", description: "Ctrl+K N", command: "criticmarkup.next" },
	{ label: "$(arrow-up) Previous change", description: "Ctrl+K B", command: "criticmarkup.prev" },
	{ label: "$(check) Accept change", description: "Ctrl+K Y", command: "criticmarkup.accept" },
	{ label: "$(close) Reject change", description: "Ctrl+K R", command: "criticmarkup.reject" },
	{ label: "$(check-all) Accept all changes", command: "criticmarkup.acceptAll" },
	{ label: "$(close-all) Reject all changes", command: "criticmarkup.rejectAll" },
	{ kind: vscode.QuickPickItemKind.Separator, label: "Setup" },
	{ label: "$(account) Set my initials", command: "criticmarkup.setInitials" },
	{ label: "$(file-code) Install Quarto HTML filter", command: "criticmarkup.installFilter" },
	{ kind: vscode.QuickPickItemKind.Separator, label: "Import" },
	{ label: "$(cloud-download) Import Hypothesis annotations", command: "criticmarkup.importHypothesis" }
];

async function showMenu() {
	const pick = await vscode.window.showQuickPick(MENU, { placeHolder: "CriticMarkup" });
	if (!pick) return;
	await vscode.commands.executeCommand(pick.command);
}

// The document the sidebar and status bar describe: the active editor, else the last supported one.
let lastEditor;
function currentEditor() {
	const ed = vscode.window.activeTextEditor;
	if (ed && isSupported(ed.document)) lastEditor = ed;
	return lastEditor && !lastEditor.document.isClosed ? lastEditor : undefined;
}

const KIND_ICON = { add: "add", delete: "remove", substitute: "replace", highlight: "comment", comment: "comment" };

class ChangesProvider {
	constructor() {
		this._emitter = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._emitter.event;
	}
	refresh() { this._emitter.fire(); }
	getTreeItem(item) { return item; }
	getChildren() {
		const ed = currentEditor();
		if (!ed) return [];
		const doc = ed.document;
		return core.findChanges(doc.getText()).map(c => {
			const l = core.label(c);
			const item = new vscode.TreeItem(l.label || "(empty)", vscode.TreeItemCollapsibleState.None);
			item.description = [l.who, "line " + (doc.positionAt(c.start).line + 1)].filter(Boolean).join(" · ");
			item.iconPath = new vscode.ThemeIcon(KIND_ICON[c.kind]);
			item.tooltip = core.describe(c).title + (l.who ? " · " + l.who : "");
			item.contextValue = "change";
			item.start = c.start;
			item.command = { command: "criticmarkup.revealChange", title: "Go to change", arguments: [c.start] };
			return item;
		});
	}
}

/** Top section of the sidebar: the actions from MENU, grouped, one click each. */
class ActionsProvider {
	constructor() {
		this.groups = [];
		let current = { name: "Edit", items: [] };
		for (const m of MENU) {
			if (!m.command) { this.groups.push(current); current = { name: m.label, items: [] }; }
			else current.items.push(m);
		}
		this.groups.push(current);
	}
	getTreeItem(item) { return item; }
	getChildren(element) {
		if (!element) {
			return this.groups.map(g => {
				const item = new vscode.TreeItem(g.name, vscode.TreeItemCollapsibleState.Expanded);
				item.group = g;
				return item;
			});
		}
		return element.group.items.map(m => {
			const parts = /^\$\((.+?)\)\s*(.*)$/.exec(m.label);
			const item = new vscode.TreeItem(parts ? parts[2] : m.label, vscode.TreeItemCollapsibleState.None);
			if (parts) item.iconPath = new vscode.ThemeIcon(parts[1]);
			item.description = m.description;
			item.command = { command: "criticmarkup.runAction", title: m.label, arguments: [m.command] };
			return item;
		});
	}
}

/** Run an action on the document the sidebar describes, returning focus to its editor first. */
async function runAction(id) {
	const ed = currentEditor();
	if (ed) await vscode.window.showTextDocument(ed.document, { viewColumn: ed.viewColumn, preserveFocus: false });
	await vscode.commands.executeCommand(id);
}

async function revealChange(offset) {
	const ed = currentEditor();
	if (!ed) return;
	const c = core.findChanges(ed.document.getText()).find(x => x.start === offset);
	if (!c) return;
	const shown = await vscode.window.showTextDocument(ed.document, { viewColumn: ed.viewColumn, preserveFocus: false });
	shown.selection = new vscode.Selection(ed.document.positionAt(c.start), ed.document.positionAt(c.end));
	shown.revealRange(shown.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

async function resolveItem(item, accept) {
	const ed = currentEditor();
	if (!ed || !item) return;
	await vscode.window.showTextDocument(ed.document, { viewColumn: ed.viewColumn, preserveFocus: true });
	await resolveAt(item.start, accept);
}

// ---------------------------------------------------------------- Hypothesis import

const TOKEN_KEY = "criticmarkup.hypothesisToken";

async function importHypothesis(context) {
	const ed = currentEditor();
	if (!ed) return vscode.window.showWarningMessage("Open a Quarto or Markdown document first.");
	const cfg = vscode.workspace.getConfiguration("criticmarkup.hypothesis");

	// the annotated page is remembered per document, so another file never reuses it by mistake
	const uris = context.workspaceState.get("criticmarkup.hypothesisUris", {});
	const docKey = ed.document.uri.fsPath;
	let uri = cfg.get("uri") || uris[docKey];
	if (!uri) {
		uri = await vscode.window.showInputBox({ prompt: "URL of the page annotated in Hypothesis (as seen by Hypothesis). Asked once per document and remembered.", ignoreFocusOut: true });
		if (!uri) return;
		await context.workspaceState.update("criticmarkup.hypothesisUris", { ...uris, [docKey]: uri.trim() });
	}
	let token = await context.secrets.get(TOKEN_KEY);
	if (!token) {
		token = await vscode.window.showInputBox({
			prompt: "Hypothesis API token. Get it at https://hypothes.is/account/developer (log in, click Generate your API token). Asked only once; it is kept in VS Code's secret storage",
			password: true, ignoreFocusOut: true
		});
		if (!token) return;
		await context.secrets.store(TOKEN_KEY, token.trim());
	}

	// the group to import from: the setting wins; otherwise ask once per document (remembered)
	const groupsKey = "criticmarkup.hypothesisGroups";
	const savedGroups = context.workspaceState.get(groupsKey, {});
	let group = savedGroups[docKey];
	try {
		const settingGroup = cfg.get("group");
		if (settingGroup) {
			const found = (await hypothesis.listGroups(token.trim())).find(g => g.name === settingGroup);
			if (!found) return vscode.window.showErrorMessage("Hypothesis group '" + settingGroup + "' (setting criticmarkup.hypothesis.group) not found.");
			group = { id: found.id, name: found.name };
		} else if (!group) {
			const groups = await hypothesis.listGroups(token.trim());
			const pick = await vscode.window.showQuickPick(
				[{ label: "All my groups", description: "public and private", group: { id: "", name: "All my groups" } },
					...groups.map(g => ({ label: g.name, description: g.id === "__world__" ? "public" : "private group", group: g }))],
				{ title: "Import annotations from which Hypothesis group? (asked once per document)", ignoreFocusOut: true });
			if (!pick) return;
			group = { id: pick.group.id, name: pick.group.name };
			await context.workspaceState.update(groupsKey, { ...savedGroups, [docKey]: group });
		}
	} catch (e) {
		if (/API 401|API 403/.test(e.message)) await context.secrets.delete(TOKEN_KEY);
		return vscode.window.showErrorMessage("Hypothesis import failed: " + e.message);
	}

	// the document plus the files it includes with {{< include >}}
	const doc = ed.document;
	const dir = path.dirname(doc.uri.fsPath);
	const docs = new Map([[doc.uri.fsPath, doc]]);
	for (const rel of hypothesis.includesOf(doc.getText())) {
		const file = path.resolve(dir, rel);
		try { docs.set(file, await vscode.workspace.openTextDocument(vscode.Uri.file(file))); } catch (e) { /* missing include */ }
	}

	let plan;
	try {
		const annotations = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: "Fetching Hypothesis annotations" },
			() => hypothesis.fetchAnnotations(token.trim(), uri.trim(), group.id));
		const texts = Object.fromEntries([...docs].map(([f, d]) => [f, d.getText()]));
		plan = hypothesis.planImport(hypothesis.toComments(annotations), texts);
	} catch (e) {
		if (/API 401|API 403/.test(e.message)) await context.secrets.delete(TOKEN_KEY);
		return vscode.window.showErrorMessage("Hypothesis import failed: " + e.message);
	}

	const { edits, unplaced, skipped, placed } = plan;
	if (unplaced.length) {
		const out = vscode.window.createOutputChannel("CriticMarkup: Hypothesis");
		out.clear();
		out.appendLine(unplaced.length + " annotation(s) need manual placement:\n");
		for (const u of unplaced) out.appendLine("- [" + u.reason + "] " + (u.comment.quote ? '"' + u.comment.quote + '"\n    ' : "") + u.comment.user + ": " + u.comment.body);
		out.show(true);
	}
	if (!edits.length) return vscode.window.showInformationMessage("Nothing to import" + (skipped ? " (" + skipped + " already in the files)" : "") + (unplaced.length ? "; " + unplaced.length + " not placed (see Output)" : "") + ".");
	const mismatch = placed < unplaced.length
		? "\n\nWARNING: only " + placed + " of " + (placed + unplaced.length) + " annotations match this document. The URL may belong to a different page."
		: "";
	const summary = "Annotations from " + uri.trim() + "\nGroup: " + group.name + mismatch + "\n\nInsert " + edits.length + " comment(s) into " + new Set(edits.map(e => e.file)).size + " file(s)"
		+ (skipped ? ", " + skipped + " already present" : "") + (unplaced.length ? ", " + unplaced.length + " not placed (see Output)" : "") + "?";
	const choice = await vscode.window.showInformationMessage(summary, { modal: true }, "Insert", "Use another URL", "Use another group");
	if (choice === "Use another URL") {
		const rest = { ...context.workspaceState.get("criticmarkup.hypothesisUris", {}) };
		delete rest[docKey];
		await context.workspaceState.update("criticmarkup.hypothesisUris", rest);
		if (cfg.get("uri")) vscode.window.showWarningMessage("The setting criticmarkup.hypothesis.uri is set and overrides the URL; clear it first.");
		return importHypothesis(context);
	}
	if (choice === "Use another group") {
		const rest = { ...context.workspaceState.get(groupsKey, {}) };
		delete rest[docKey];
		await context.workspaceState.update(groupsKey, rest);
		if (cfg.get("group")) vscode.window.showWarningMessage("The setting criticmarkup.hypothesis.group is set and overrides the choice; clear it first.");
		return importHypothesis(context);
	}
	if (choice !== "Insert") return;

	const we = new vscode.WorkspaceEdit();
	for (const e of edits) {
		const d = docs.get(e.file);
		we.replace(d.uri, new vscode.Range(d.positionAt(e.start), d.positionAt(e.end)), e.text);
	}
	await vscode.workspace.applyEdit(we);
	vscode.window.showInformationMessage("Inserted " + edits.length + " Hypothesis comment(s). Files are modified but not saved; undo works per file.");
}

// ---------------------------------------------------------------- activation

function activate(context) {
	makeDecorations();
	paintAll();

	const provider = new ChangesProvider();
	const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	status.command = "criticmarkup.menu";
	const tip = new vscode.MarkdownString(undefined, true);
	tip.isTrusted = { enabledCommands: MENU.filter(m => m.command).map(m => m.command) };
	tip.appendMarkdown("**CriticMarkup**\n\n");
	let first = true;
	for (const m of MENU) {
		if (!m.command) { tip.appendMarkdown("\n\n"); first = true; continue; }
		tip.appendMarkdown((first ? "" : " &nbsp;·&nbsp; ") + "[" + m.label.replace(/ \(.*/, "") + "](command:" + m.command + ")");
		first = false;
	}
	status.tooltip = tip;
	const updateUi = () => {
		const ed = vscode.window.activeTextEditor;
		if (ed && isSupported(ed.document)) {
			status.text = "$(comment-discussion) CriticMarkup " + core.findChanges(ed.document.getText()).length;
			status.show();
		} else {
			status.hide();
		}
		provider.refresh();
	};

	const cmd = (id, fn) => context.subscriptions.push(vscode.commands.registerCommand(id, fn));
	for (const kind of ["add", "delete", "substitute", "highlight"]) {
		cmd("criticmarkup." + kind, () => insert(context, kind));
	}
	cmd("criticmarkup.accept", () => resolveCommand(true, "cursor"));
	cmd("criticmarkup.reject", () => resolveCommand(false, "cursor"));
	cmd("criticmarkup.acceptAll", () => resolveCommand(true, "all"));
	cmd("criticmarkup.rejectAll", () => resolveCommand(false, "all"));
	cmd("criticmarkup.acceptAt", o => resolveAt(o, true));
	cmd("criticmarkup.rejectAt", o => resolveAt(o, false));
	cmd("criticmarkup.next", () => go(true));
	cmd("criticmarkup.prev", () => go(false));
	cmd("criticmarkup.setInitials", () => getInitials(context, true));
	cmd("criticmarkup.installFilter", () => installFilter(context));
	cmd("criticmarkup.importHypothesis", () => importHypothesis(context));
	cmd("criticmarkup.clearHypothesisToken", () => context.secrets.delete(TOKEN_KEY));
	cmd("criticmarkup.menu", showMenu);
	cmd("criticmarkup.runAction", runAction);
	cmd("criticmarkup.revealChange", revealChange);
	cmd("criticmarkup.acceptItem", item => resolveItem(item, true));
	cmd("criticmarkup.rejectItem", item => resolveItem(item, false));
	cmd("criticmarkup.refreshView", () => provider.refresh());

	context.subscriptions.push(
		{ dispose: () => Object.values(decorations).forEach(d => d.dispose()) },
		vscode.languages.registerHoverProvider(LANGS.map(language => ({ language })),
			{ provideHover: hoverFor }),
		status,
		vscode.window.registerTreeDataProvider("criticmarkup.changes", provider),
		vscode.window.registerTreeDataProvider("criticmarkup.actions", new ActionsProvider()),
		vscode.window.onDidChangeActiveTextEditor(ed => { paint(ed); updateUi(); }),
		vscode.window.onDidChangeVisibleTextEditors(paintAll),
		vscode.workspace.onDidChangeTextDocument(e => {
			vscode.window.visibleTextEditors.filter(ed => ed.document === e.document).forEach(paint);
			updateUi();
		}),
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration("criticmarkup.background")) { makeDecorations(); paintAll(); }
		})
	);
	updateUi();
}

exports.activate = activate;
exports.deactivate = function () {};
