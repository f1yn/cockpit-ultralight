<div align="center">
  <img width=320" height="320" src="static/cockpit-ultralight-icon.svg" />
  <br>
  <h1>Cockpit Ultralight (Starter Project)</h1>
  <p><b>[WIP]</b> A lightweight project template for developing <a href="https://cockpit-project.org/">cockpit plugins</a></p>
</div>

## Why?

-   Lightweight. Focused on getting things live and in the air by focusing on providing a concise tooling environment
-   Typescript support (for both code and build scripts).
-   Recycles code and styles already present in the live cockpit environment (not needing the cockpit git tree to operate/test), removing the need for complicated build steps
-   Dark mode synchronisation
-   Live reloading functionality

Being ultralight also means that we don't need to worry as much about what's inside `node_modules`. I would hope that developing a cockpit plugin would mean an individual would _only_ install trusted code when developing plugins.

> The [cockpit/starter-kit](https://github.com/cockpit-project/starter-kit) project is very powerful, and does a lot more things than this project. I enjoy learning things the hard way to build up comprehension, and while providing focus to areas that I know very well. Being able to work with tooling and a more limited set of languages provides me with clarity when trying to solve problems. I'm hoping some of the improvements made here can be brought back upstream.
>
> Specific tooling is being planned for [building distribution packages](https://github.com/f1yn/cockpit-ultralight/issues/1).

## Using this starter project

Here's a couple ways to get started, allowing you to create and manage your own projects with this as a base.

### Method A - Forking via GitHub

1. Fork the repo
2. Clone the repo locally
3. `git branch -m main template` will move this upstream to `template`
4. `git branch -b main` will create a main branch, that's based on template
5. `git push` will sync your repo, assuming you've already setup git

### Method B - Creating Custom Repository (any platform)

This method is useful for developing more than plugin at a time, and makes porting updates a little easier (I'm currently doing this with a few projects).

1. Create a new git project on your provider of choice (i.e GitHub)
2. Clone the ultralight repo locally, preferably in a directory that will match your project:

    ```bash
    git clone https://github.com/f1yn/cockpit-ultralight my-cockpit-project
    ```

3. Rename the current origin to `template`:

    ```bash
    git remote rename origin template
    ```

4. Set your `origin` to your new project url

    ```bash
    git remote add origin https://your_target_git_repo
    ```

5. Push up your `main` branch
    ```bash
    git push -u origin main
    ```

## Setting up (any Linux)

> **Important:** It's recommended to use [fmn](https://github.com/Schniz/fnm) install providing nodejs. It enables building more nodejs/npm projects in different shells. Otherwise, (Fedora) `sudo dnf install nodejs npm` (or equivalent on your Linux distribution).

### Installing the project

```
npm install
```

That's it.

### Configuring the plugin

Set the project name, cockpit menu title and minimum cockpit version, then install and
refresh the vendored types:

```sh
npm run setup
```

It prompts for every value (accepting the current ones as defaults) and prints
`npm run build` and `npm run link:local` as the next steps — setup does not build or link for
you. For automation, pass the values directly:

```sh
npm run setup -- --name my-plugin --title "My Plugin" --cockpit 360 --yes
```

Add `--dry-run` to preview, or `--help` for the full flag list. The cockpit version is a bare
number, never an operator — see
[Compatibility](#compatibility-requirescockpit-is-a-bare-version).

The README is not touched by the script: rewriting it into your plugin's own documentation is
an editorial job. Agents do it from `.agents/skills/setup/SKILL.md`, which asks for a
one-paragraph description and then replaces the template intro, the starter-project pitch and
the demo screenshots while keeping the sections below `## Setting up`.

### Building and testing (any Linux, any shell)

1. Produce a static production build of the project with the following command

    ```sh
    npm run build
    ```

2. Link the project to your local environment

    ```sh
    mkdir -p ~/.local/share/cockpit
    npm run link:local
    ```

3. Develop within the project (eventually with live reloads)
    ```sh
    npm run dev
    ```

After changes are made, assuming you followed the link directions, the plugin will refresh the page
automatically!

### Checks

One canonical command per concern, all offline:

-   `npm run typecheck` — `tsc --noEmit` with `strict` on
-   `npm run format:check` — formatting gate ([oxfmt](https://oxc.rs/docs/guide/usage/formatter))
-   `npm run sync:cockpit-types -- --check` — verifies `vendor/cockpit-types/` against its pinned provenance hashes
-   `npm run check` — format, types, vendored-type drift, then a production build

`vendor/cockpit-types/` is a byte-for-byte snapshot of cockpit's upstream JS API types
taken at a pinned commit. Never edit it by hand: `npm run sync:cockpit-types` refreshes it
and rewrites `provenance.json`. Those files keep their upstream licenses (`GPL-3.0-or-later`
and `LGPL-2.1-or-later`); this project's own code stays MIT. The split is recorded in
[`vendor/cockpit-types/NOTICE`](./vendor/cockpit-types/NOTICE).

### Installing on a cockpit host

Cockpit scans two package locations, and `cockpit-bridge` is the authority on both:

-   **Per-user** — `~/.local/share/cockpit/<project>/` (what `npm run link:local` targets locally)
-   **System-wide** — `/usr/share/cockpit/<project>/` (requires root)

Confirm the plugin was actually discovered, rather than assuming it:

```sh
cockpit-bridge --packages
```

That prints every package cockpit can see, with its menu label and path. If the plugin is
missing from the cockpit menu, it is almost always a rejected `manifest.json`: the bridge
logs the reason and silently drops the package.

### Compatibility: `requires.cockpit` is a bare version

`manifest.json`'s `requires.cockpit` is a **minimum version written as a bare number**:

```json
{ "requires": { "cockpit": "360" } }
```

**Not** `">= 360"`. Cockpit compares `sortify_version(required) > running_version`, so any
comparison operator sorts *above* every numeric version and fails permanently — the bridge
logs `required cockpit version (>= 360) not met` and the plugin never appears. Raise the
number to the oldest cockpit generation that supports everything this project relies on:
PatternFly 6 class names (e.g. `pf-v6-theme-dark`) and the `cockpit.file` / `cockpit.script`
/ `cockpit.format` APIs. Cockpit 360 satisfies both.

### Publishing to a remote cockpit

`link:local` symlinks `dist/` for a cockpit on this machine. For a cockpit on another
host, publish the build over SSH:

```sh
npm run deploy -- --target user@host --dry-run   # preview the file list
npm run deploy -- --target user@host --yes       # mirror dist/ into ~/.local/share/cockpit/<name>
```

**Requires `rsync`** (macOS ships openrsync; Linux packages it) plus `ssh` key access to
the target — there is no fallback transport. It mirrors, so files removed locally disappear
remotely; pass `--no-delete` for an additive copy. `--path` overrides the remote directory —
required for a system-wide `/usr/share/cockpit/<name>` install — and `--port` handles a
non-default SSH port; `--help` lists every flag. It refuses to publish an incomplete `dist/`,
refuses `rsync --delete` into a directory that does not end with the project name, stores no
credentials, and verifies the remote file count after transferring.

Agents get the same behaviour from `.agents/skills/deploy/SKILL.md`.

## Example

**Without adding anything new, you'll be greeted by a screen like this:**

-   A simple screen built using [patternfly](https://www.patternfly.org/) components
-   A statically loaded SVG (from the `/static` directory)
-   A live preview of the current contents of `/etc/hostname`
-   A stored output of the latest execution of the `hostnamectl` (in a user shell)

<img width="1207" alt="Screenshot 2024-03-25 131525" src="https://github.com/f1yn/cockpit-ultralight/assets/6565187/5766547b-8a24-4911-a48d-f68ebaf7a906">

**With dark mode:**

![Screenshot 2024-03-25 223505](https://github.com/f1yn/cockpit-ultralight/assets/6565187/6c0fe003-5713-408f-b3db-467390dcc4f6)

## Project structure

-   `src/` The primary source
-   `dist/` The build output directory (not in the project tree)
-   `static/` Static files that are needed for the Cockpit plugin to function. Any files added or edited here will be reflected during live development (placed into `dist/`), or added during production builds
-   `scripts/` Scripts needed for building, editing and maintaining the project
-   `scripts/shared/` Helpers shared by those scripts (CLI prompts, flags, subprocesses, paths)
-   `scripts/.deploy-remote.sh` Machine-local deploy helper (gitignored; `npm run deploy` supersedes it)
-   `vendor/cockpit-types/` Pinned, hash-gated snapshot of cockpit's upstream API types (generated, never hand-edited)

## Adding styles

One of the concepts of ultralight is not carrying redundant weight, which means by default, the [patternfly](https://www.patternfly.org/) styles aren't included in the output, as they are already bundled and provided by the parent cockpit window (same origin frames have access to the parent and window contexts). These urls are copied from the parent iframe [here](./src/init.ts).

to add your own styles, simply add a css file to your `src` directory, and import said css file within `app.tsx` (or any other component within your app). This relies on esbuild css bundling.

## Swapping from React/changing the build

The developers of starter-kit mention that keeping the design language consistent is pretty important, so using their React [patternfly](https://www.patternfly.org/) components is probably the easiest way to integrate with their structure. If, for some reason you find React abhorrently unbearable (i.e you're a Vue or Angular dev), modifying the `scripts/build.ts` file to match your needs should be straightforward.
