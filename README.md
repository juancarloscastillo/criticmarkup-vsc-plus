# CriticMarkup VSC-plus

![](media/icon.png)

-   Track changes for plain-text `.qmd` and `.md` files, using [CriticMarkup](https://criticmarkup.com/).
-   Works in files whose language mode is **Quarto** (`.qmd`), **Markdown** (`.md`) or **R Markdown** (`.Rmd`).
-   Import comments from [Hypothesis](https://hypothes.is) annotations on a published version of your document (details below), choosing the Hypothesis group to pull from.

## The Background

Keep track for changes in plain-text is hard. You can do something in Git, but it does not show changes inline and it is not always available to collaborators.

**CriticMarkup** is a way of dealing with this problem. It adds different tags to your text to mark additions, deletions, substitutions, and comments. Nevertheless, it is a seemingly abandoned project, and the VSC available extension is unmaintained (the web site is down, and the Git repo last commit was several years ago).

**CriticMarkup VSC-plus** is a fork of the original extension, with some improvements and bug fixes. It is compatible with the original CriticMarkup syntax, and adds some new features, such as:

-   available for Quarto files (`.qmd`) and R Markdown files (`.Rmd`)
-   a sidebar with a list of all changes in the document, and buttons to accept or reject them
-   a status bar item with the number of changes, and a popup with clickable actions
-   a command to install a Quarto HTML filter to render the changes in HTML
-   a command to set your initials for the changes you make
-   a hover popup on each change, showing who made it and buttons to accept or reject it
-   different colors for the changes, configurable in the settings
-   Reviewer Mode: your typing and deleting is recorded automatically as changes
-   import of [Hypothesis](https://hypothes.is) annotations (public or private groups) as CriticMarkup comments

## Markup tags

| Markup                        | Meaning                     |
|-------------------------------|-----------------------------|
| `{++text++}{>>JC<<}`          | addition by JC              |
| `{--text--}{>>JC<<}`          | deletion by JC              |
| `{~~old~>new~~}{>>JC<<}`      | substitution by JC          |
| `{==text==}{>>JC: comment<<}` | comment on highlighted text |

The first time you insert something in a workspace, you are asked for your initials (prefilled from `git config user.name`). They are stored per workspace on your machine, not in the repository. Change them with **CriticMarkup: Set My Initials**.

## Buttons and sidebar

-   **Editor title bar:** a speech-bubble button; click it for a dropdown with all actions.
-   **Status bar (bottom right):** `CriticMarkup N` shows the number of changes; hover for a popup with clickable actions, or click for the actions menu.
-   **Sidebar:** the CriticMarkup icon in the activity bar opens a pane with two sections. **Actions** (top) lists every action, one click each. **Changes** (below) lists every change in the active document. Click one to jump to it; use the inline ✓ / ✗ buttons to accept or reject it, and the title buttons for the menu or Accept / Reject All.

## Shortcuts

Press `Ctrl+K`, release, then the letter (chords avoid clashes with AltGr keyboard layouts).

| Chord                 | Action                                  |
|-----------------------|-----------------------------------------|
| `Ctrl+K` `A`          | add text                                |
| `Ctrl+K` `D`          | delete selection                        |
| `Ctrl+K` `X`          | substitute selection                    |
| `Ctrl+K` `C`          | comment (highlights the selection)      |
| `Ctrl+K` `N` / `B`    | next / previous change                  |
| `Ctrl+K` `Y`          | accept change at cursor or in selection |
| `Ctrl+K` `R` (or `U`) | reject change at cursor or in selection |
| `Ctrl+K` `T` | turn Reviewer Mode on / off |

Hover over a change to see who made it and to accept or reject it with a click. **Accept All / Reject All Changes in Document** are in the command palette.

`Ctrl+K` `R` replaces VS Code's built-in *Reveal Active File in File Manager* inside Quarto/Markdown/R Markdown editors. If it does not trigger in your setup, use `Ctrl+K` `U`, or add this to your user `keybindings.json`:

``` json
{ "key": "ctrl+k r", "command": "-workbench.action.files.revealActiveFileInWindows" }
```

## Reviewer mode

Reviewer Mode records your edits as CriticMarkup while you write normally, so you do not have to insert each tag by hand.

**How to use it**

1. Open a `.qmd`, `.md` or `.Rmd` file.
2. Turn it on with `Ctrl+K` `T`, the **Review off** button in the status bar (bottom right), or **Toggle Reviewer Mode** in the CriticMarkup menu. The first time it asks for your initials.
3. The status bar changes to a highlighted **Reviewing**. Write and delete as usual.
4. Turn it off the same way. It is always off when VS Code starts.

**What gets recorded** (all tagged with your initials)

| You do | Result |
|---|---|
| type new text | `{++text++}{>>JC<<}` (continued typing extends the same addition) |
| delete text | `{--text--}{>>JC<<}` (consecutive Backspace / Delete presses merge into one deletion) |
| type over a selected text | `{~~old~>new~~}{>>JC<<}` |

**Good to know**

- Editing the text inside your own additions or comments works normally.
- Deleting a character of the markup itself (`{ } + - ~ = < >`) is blocked, so the structure cannot break.
- `Ctrl+Z` works as usual. Pasted CriticMarkup and the extension's own commands are not re-wrapped.
- Multi-cursor edits and edits in Quarto's visual mode are not tracked.

## Quarto visual editor

The Quarto *visual mode* is a separate web view, so colors, hover popups and shortcuts do not work there, and CriticMarkup tags appear as plain text. Running an action from the sidebar, the status bar or the editor-title menu while in visual mode switches the document to source mode first, then applies the action. Use source mode to review changes.

## Settings

-   `criticmarkup.background`: background behind changes. Default `rgba(128,128,128,0.22)` (works on light and dark themes). Empty for none.
-   `criticmarkup.hypothesis.group`: name of a Hypothesis group to always import from (skips the group picker).
-   `criticmarkup.hypothesis.uri`: URL of the annotated page; when set, it is used for every document instead of asking.

## Importing Hypothesis annotations

Comments left with [Hypothesis](https://hypothes.is) on a published version of your document can be pulled back into the source as CriticMarkup comments (`{==quoted text==}{>>user: comment<<}`).

1.  From the sidebar, open the CriticMarkup pane and click **Import Hypothesis annotations**.
2.  The first time you are asked for an API token ([hypothes.is/account/developer](https://hypothes.is/account/developer)); it is kept in VS Code's secret storage (**Forget Hypothesis API token** removes it).
3.  Copy the URL of the published page (e.g. `https://mydomain.com/mydoc.html`) and paste it into the input box. It is remembered per document, so each file has its own page.
4.  Pick the Hypothesis **group** to import from: *Public*, one of your private groups, or *All my groups*. Also remembered per document.
5.  The document and the files it pulls in with `{{< include >}}` are searched. You see a summary (page URL, group, number of comments, a warning if most annotations do not match the document) and confirm before anything is inserted; undo works per file. The dialog has **Use another URL** and **Use another group** buttons to change them.

A quote is inserted only if it matches the source exactly once. Page-level notes and quotes that are not found (e.g. rendered citations) or are ambiguous are listed in the Output panel for manual placement. Re-running skips comments already imported, and replies are appended to their parent comment.

## Rendering in HTML

Installing the extension does **not** change how Quarto renders your document. Editing in VS Code works on its own; to see the changes in the rendered HTML you need to add a small Quarto filter to your project (one-time setup per project):

1.  Open your `.qmd` file and run **CriticMarkup: Install Quarto HTML Filter** from the command palette (or the sidebar). This copies `criticmarkup.lua` into the same folder as the document.

2.  Add the filter to the document's YAML:

    ``` yaml
    format:
      html:
        filters:
          - criticmarkup.lua
    ```

3.  Commit `criticmarkup.lua` to your repository. Co-authors who render the document need this file; co-authors who only edit in VS Code do not.

Without the filter, the markup (`{++...++}`) appears as plain text in the rendered HTML.

Additions render green, deletions red with strikeout, substitutions as both, and comments as small tags. Set `criticmarkup: accept` or `criticmarkup: reject` in the YAML to render a clean version. The filter is HTML-only; other formats are left untouched, so accept or reject all changes before rendering a PDF.

## Install

Search for *CriticMarkup VSC-plus* in the VS Code extensions marketplace. In case you have the original *CriticMarkup for Visual Studio Code* extension installed, uninstall it first to avoid duplicate highlighting and shortcuts.

## Development

`src/core.js` holds the parsing logic and has no VS Code dependency: `npm test`. Package with `npx @vscode/vsce package`.

## Changelog

-   **0.4.2:** Hypothesis import: choose the group (public, private or all), remembered per document.
-   **0.4.1:** Hypothesis import: the page URL is remembered per document; the dialog shows the source and warns about mismatches; works without an open folder.
-   **0.4.0:** Import of Hypothesis annotations as CriticMarkup comments.
-   **0.3.2:** Marketplace icon; clearer Quarto filter instructions.
-   **0.3.1:** Substitutions: only the replaced text is struck out.
-   **0.3.0:** Sidebar with two sections, Actions and Changes.
-   **0.2.1:** Editor-title dropdown and status bar hover popup.
-   **0.2.0:** Actions menu, changes sidebar and status bar counter.
-   **0.1.1:** R Markdown (`.Rmd`) support.
-   **0.1.0:** First release: insert, accept/reject and navigate changes, hover popups, colors, HTML filter.

Full details in [CHANGELOG.md](CHANGELOG.md).