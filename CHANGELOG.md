# Changelog

## 0.4.1
- Hypothesis import: the annotated page URL is remembered per document (not in settings), so another file never reuses it. The confirmation dialog shows the source URL, warns when most annotations do not match the document, and has a **Use another URL** button.
- The URL and token prompts explain where to get them and that they are asked only once.
- Import works in windows with no folder open.

## 0.4.0
- **Import Hypothesis annotations** as `{==quote==}{>>user: comment<<}` into the document and its `{{< include >}}` files. Quotes that don't match exactly once are listed in the Output panel; already-imported comments are skipped; one undo per file. The API token is kept in VS Code's secret storage.

## 0.3.2
- Add Marketplace icon; clarify Quarto HTML filter setup in the README.

## 0.3.1
- Substitutions: only the replaced (old) text is struck out; the new text is shown in green. Fixes Markdown strikethrough covering the whole `{~~old~>new~~}` block.

## 0.3.0
- The sidebar pane now has two sections: **Actions** (one-click list of all actions) above **Changes**.

## 0.2.1
- The editor-title button is now a dropdown with all actions; the status bar item has a hover popup with clickable actions.
- Accept All / Reject All always ask for confirmation.

## 0.2.0
- Actions menu (quick pick) with all commands, opened from an editor-title button, a status bar item or the sidebar.
- Sidebar panel listing every change in the active document, with go-to, inline Accept / Reject, and Accept All / Reject All.
- Status bar item showing the number of changes in the active document.

## 0.1.1
- Also active in R Markdown (`.Rmd`) files.

## 0.1.0
- Insert additions, deletions, substitutions and comments, tagged with the author's initials (asked once per workspace).
- Accept / reject the change at the cursor, in a selection, or in the whole document.
- Next / previous change navigation.
- Hover popup with change details and Accept / Reject links.
- Light/dark aware highlighting with a configurable background.
- Bundled Quarto Lua filter that renders changes in HTML (`CriticMarkup: Install Quarto HTML Filter`).
