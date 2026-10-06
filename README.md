# CriticMarkup VSC-plus

![](media/icon.png)


Track changes for plain-text `.qmd` and `.md` files, using [CriticMarkup](https://criticmarkup.com/).
Works in files whose language mode is **Quarto** (`.qmd`), **Markdown** (`.md`) or **R Markdown** (`.Rmd`).

## The Background

Keep track for changes in plain-text is hard. You can do something in Git, but it does not show changes inline and it is not always available to collaborators. 

**CriticMarkup** is a way of dealing with this problem. It adds different tags to your text to mark additions, deletions, substitutions, and comments. Nevertheless, it is a seemingly abandoned project, and the VSC available extension is unmaintained (the web site is down, and the Git repo last commit was several years ago).

**CriticMarkup VSC-plus** is a fork of the original extension, with some improvements and bug fixes. It is compatible with the original CriticMarkup syntax, and adds some new features, such as:

- available for Quarto files (`.qmd`) and R Markdown files (`.Rmd`) 
- a sidebar with a list of all changes in the document, and buttons to accept or reject them
- a status bar item with the number of changes, and a popup with clickable actions
- a command to install a Quarto HTML filter to render the changes in HTML
- a command to set your initials for the changes you make
- a hover popup on each change, showing who made it and buttons to accept or reject it
- different colors for the changes, configurable in the settings

## Markup tags

| Markup | Meaning |
|---|---|
| `{++text++}{>>JC<<}` | addition by JC |
| `{--text--}{>>JC<<}` | deletion by JC |
| `{~~old~>new~~}{>>JC<<}` | substitution by JC |
| `{==text==}{>>JC: comment<<}` | comment on highlighted text |

The first time you insert something in a workspace, you are asked for your initials (prefilled from `git config user.name`). They are stored per workspace on your machine, not in the repository. Change them with **CriticMarkup: Set My Initials**.


## Buttons and sidebar

- **Editor title bar:** a speech-bubble button; click it for a dropdown with all actions.
- **Status bar (bottom right):** `CriticMarkup N` shows the number of changes; hover for a popup with clickable actions, or click for the actions menu.
- **Sidebar:** the CriticMarkup icon in the activity bar opens a pane with two sections. **Actions** (top) lists every action, one click each. **Changes** (below) lists every change in the active document. Click one to jump to it; use the inline ✓ / ✗ buttons to accept or reject it, and the title buttons for the menu or Accept / Reject All.

## Shortcuts

Press `Ctrl+K`, release, then the letter (chords avoid clashes with AltGr keyboard layouts).

| Chord | Action |
|---|---|
| `Ctrl+K` `A` | add text |
| `Ctrl+K` `D` | delete selection |
| `Ctrl+K` `X` | substitute selection |
| `Ctrl+K` `C` | comment (highlights the selection) |
| `Ctrl+K` `N` / `B` | next / previous change |
| `Ctrl+K` `Y` | accept change at cursor or in selection |
| `Ctrl+K` `R` (or `U`) | reject change at cursor or in selection |

Hover over a change to see who made it and to accept or reject it with a click.
**Accept All / Reject All Changes in Document** are in the command palette.

`Ctrl+K` `R` replaces VS Code's built-in *Reveal Active File in File Manager* inside Quarto/Markdown/R Markdown editors. If it does not trigger in your setup, use `Ctrl+K` `U`, or add this to your user `keybindings.json`:

```json
{ "key": "ctrl+k r", "command": "-workbench.action.files.revealActiveFileInWindows" }
```

## Settings

- `criticmarkup.background`: background behind changes. Default `rgba(128,128,128,0.22)` (works on light and dark themes). Empty for none.

## Rendering in HTML

Run **CriticMarkup: Install Quarto HTML Filter** next to your document, then add to the YAML:

```yaml
format:
  html:
    filters:
      - criticmarkup.lua
```

Additions render green, deletions red with strikeout, substitutions as both, and comments as small tags. Set `criticmarkup: accept` or `criticmarkup: reject` in the YAML to render a clean version. The filter is HTML-only; other formats are left untouched, so accept or reject all changes before rendering a PDF.

## Install

Search for *CriticMarkup VSC-plus* in the VS Code extensions marketplace. In case you have the original *CriticMarkup for Visual Studio Code* extension installed, uninstall it first to avoid duplicate highlighting and shortcuts.

## Development

`src/core.js` holds the parsing logic and has no VS Code dependency: `npm test`. Package with `npx @vscode/vsce package`.
