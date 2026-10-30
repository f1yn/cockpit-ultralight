---
name: setup
description: Configure this cockpit plugin template for a new project — the script sets the package/project name, cockpit menu title and minimum cockpit version, installs and refreshes the vendored types; this skill also rewrites the README into the user's own plugin README. Use when the user asks to set up, initialize, rename, rebrand, or configure the template.
---

# Setup

Two distinct halves:

- **Mechanical values** (name, menu title, cockpit version, install, vendored types) are the
  script's job: `scripts/setup.ts` via `npm run setup`.
- **Prose** (the README) is your job. No script rewrites documentation here; do it yourself
  with the editing tools, following section 3.

## 1. Gather the values

| Value                                   | Flag        | Default when unknown                                 |
| --------------------------------------- | ----------- | ---------------------------------------------------- |
| Project name (package + directory slug) | `--name`    | current `name` in `package.json`                     |
| Cockpit menu title                      | `--title`   | current `static/manifest.json` → `tools.index.label` |
| Minimum cockpit version                 | `--cockpit` | current `static/manifest.json` → `requires.cockpit`  |

Read the current values before asking, so every question carries a concrete default:

```sh
node -p "require('./package.json').name"
grep -A3 '"tools"' static/manifest.json
```

**If a value is not determinable from the user's request, ask for it — never guess.**
Use `ask_user`, one focused question per missing value, and put the current/default
value in the options, for example:

- question: ``Project name? (current: `cockpit-ultralight`; lowercase slug, no spaces)``
- options: `[{"title": "cockpit-ultralight"}]` plus a freeform entry

Ask for `--cockpit` only when the target host's version differs from the current value.

Hard rules:

- **Never invent or widen the cockpit version.** It must come from the user or from the
  target host (`cockpit-bridge --version`). It is a **bare number** (`360`), never an
  operator — `">= 360"` makes cockpit silently drop the package (see README
  "Compatibility: `requires.cockpit` is a bare version"). The script rejects operators.
- **Never pass `--allow-dirty` on your own.** It exists so a human can bypass the
  clean-tree guard; ask first.

## 2. Preview, then apply

The flag names below are the contract; `npm run setup -- --help` is the authoritative list
if this document drifts.

```sh
npm run setup -- --name <slug> --title "<menu title>" --cockpit <version> --dry-run
```

Show the user the printed plan (it lists unchanged values too), then apply:

```sh
npm run setup -- --name <slug> --title "<menu title>" --cockpit <version> --yes
```

Add `--no-install` only if dependencies are already installed. The script refuses to
overwrite `package.json` / `static/manifest.json` when they have uncommitted changes — if
that happens, tell the user to commit or stash first. It deliberately stops before building
or linking; it prints `npm run build` and `npm run link:local` as next steps, which you
should run only if the user asks for them.

## 3. Rebrand the README (your job, not the script's)

Ask the user for **one or two sentences describing their plugin** unless they already said
it. That description is the only thing you cannot derive. Then edit `README.md` directly:

1. **Replace everything from the top of the file up to (not including) `## Setting up`** with:

    ```md
    # <menu title>

    <the user's one or two sentences, as a single paragraph>

    Built on [cockpit-ultralight](https://github.com/f1yn/cockpit-ultralight), a minimal
    cockpit plugin template.
    ```

    That removes the centred logo `<div>`, the "Why?" pitch and the "Using this starter
    project" fork/clone instructions.

2. **Delete the `## Example` section** — its heading, the bullet list and both screenshots —
   up to the next `## ` heading (`## Project structure`).

3. **Leave everything from `## Setting up` onward alone**: install, configuring, building,
   checks, cockpit host notes, compatibility, publishing, project structure, adding styles,
   swapping React. They are maintained by the project, not by this rebrand.

Rules: do not invent badges, feature lists, screenshots or a licence change; do not touch
`vendor/cockpit-types/**`; keep the user's wording rather than rewriting it. If `README.md`
has no `## Setting up` heading, stop and report instead of guessing — the file is not the
expected template.

## 4. Verify

```sh
npm run check
cockpit-bridge --packages   # only when cockpit is installed on this machine
```

`npm run check` must exit 0. `cockpit-bridge --packages` should list the new name with the
chosen title and no `required cockpit version … not met` warning. For the README, confirm
`grep '^## ' README.md` no longer lists `## Example`, `## Why?` or `## Using this starter
project`, and that line 1 is `# <menu title>`.

## On failure

Report the script's message verbatim and stop. Do not retry with guessed values, and do not
hand-edit `package.json`, `static/manifest.json`, or `vendor/cockpit-types/**` to work around
an error — `vendor/` is hash-gated.
