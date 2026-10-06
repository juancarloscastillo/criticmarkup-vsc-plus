# Changelog

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
