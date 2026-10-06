# CriticMarkup VSC-plus

Track changes for plain-text `.qmd` and `.md` files, using [CriticMarkup](https://criticmarkup.com/).
Works in files whose language mode is **Quarto** (`.qmd`), **Markdown** (`.md`) or **R Markdown** (`.Rmd`).

## Markup

| Markup | Meaning |
|---|---|
| `{++text++}{>>JC<<}` | addition by JC |
| `{--text--}{>>JC<<}` | deletion by JC |
| `{~~old~>new~~}{>>JC<<}` | substitution by JC |
| `{==text==}{>>JC: comment<<}` | comment on highlighted text |

The first time you insert something in a workspace, you are asked for your initials (prefilled from `git config user.name`). They are stored per workspace on your machine, not in the repository. Change them with **CriticMarkup: Set My Initials**.

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

## Buttons and sidebar

- **Editor title bar:** a speech-bubble button; click it for a dropdown with all actions.
- **Status bar (bottom right):** `CriticMarkup N` shows the number of changes; hover for a popup with clickable actions, or click for the actions menu.
- **Sidebar:** the CriticMarkup icon in the activity bar opens a pane with two sections. **Actions** (top) lists every action, one click each. **Changes** (below) lists every change in the active document. Click one to jump to it; use the inline ✓ / ✗ buttons to accept or reject it, and the title buttons for the menu or Accept / Reject All.

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

```
code --install-extension criticmarkup-vsc-plus-0.3.1.vsix
```

Uninstall the older *CriticMarkup for Visual Studio Code* extension and any local companion extension first, to avoid duplicate highlighting and shortcuts.

## Development

`src/core.js` holds the parsing logic and has no VS Code dependency: `npm test`. Package with `npx @vscode/vsce package`.
