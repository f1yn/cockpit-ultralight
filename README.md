#

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

Being ultralight also means that we don't need to worry as much about what's inside `node_modules`. I would hope that developing a cockpit plugin would mean an individual would _only_ install trusted code when developing plugins.

> The [cockpit/starter-kit](https://github.com/cockpit-project/starter-kit) project is very powerful, and does a lot more things than this project. I enjoy learning things the hard way to build up comprehension, and while providing focus to areas that I know very well. Being able to work with tooling and a more limited set of languages provides me with clarity when trying to solve problems. I'm hoping some of the improvements made here can be brought back upstream.
>
> Specific tooling is being planned for [live plugin reloads](https://github.com/f1yn/cockpit-ultralight/issues/2) and [building distribution packages](https://github.com/f1yn/cockpit-ultralight/issues/1).

## Using

I recommend using the `Use as template` button located near the top of the repo, otherwise you can manually create a new project locally by running:

```sh
git clone https://github.com/f1yn/cockpit-ultralight
```

You can then remove the `.git` directory if present; opting to create a new repo with `git init` or your own CVS of choice.

## Setting up (any Linux)

> I recommend using [fmn](https://github.com/Schniz/fnm) install fo installing nodejs. It enables building more nodejs/npm projects in more different shells. Otherwise, (Fedora) `sudo dnf install nodejs npm` (or equivalent on your Linux distribution).

## Building and testing (any Linux, any shell)

1. Produce a static production build of the project with the following command

```sh
npm build
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

> Until live reloads are figured out, you'll need to manually refresh that page after updates

## Project structure

-   `src/` The primary source
-   `dist/` The build output directory (not in the project tree)
-   `static/` Static files that are needed for the Cockpit plugin to function. Any files added or edited here will be reflected during live development (placed into `dist/`), or added during production builds
-   `scripts/` Scripts needed for building, editing and maintaining the project

## Adding styles

One of the concepts of ultralight is not carrying redundant weight, which means by default, the patternfly styles aren't included in the output, as they are already bundled and provided by the parent cockpit window (same origin frames have access to the parent and window contexts). These urls are copied from the parent iframe [here](./static/inheritStyles.js).

to add your own styles, simply add a css file to your `src` directory, and import said css file within `app.tsx` (or any other component within your app). This relies on esbuild css bundling.

## Swapping from React/changing the build

The developers of starter-kit mention that keeping the design language consistent is pretty important, so using their React patternfly components is probably the easiest way to integrate with their structure. If, for some reason you find React abhorrently unbearable (i.e you're a Vue or Angular dev), modifying the `scripts/build.ts` file to match your needs should be straightforward.
