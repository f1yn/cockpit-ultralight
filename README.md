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
-   Dark mode synchronisation

Being ultralight also means that we don't need to worry as much about what's inside `node_modules`. I would hope that developing a cockpit plugin would mean an individual would _only_ install trusted code when developing plugins.

> The [cockpit/starter-kit](https://github.com/cockpit-project/starter-kit) project is very powerful, and does a lot more things than this project. I enjoy learning things the hard way to build up comprehension, and while providing focus to areas that I know very well. Being able to work with tooling and a more limited set of languages provides me with clarity when trying to solve problems. I'm hoping some of the improvements made here can be brought back upstream.
>
> Specific tooling is being planned for [live plugin reloads](https://github.com/f1yn/cockpit-ultralight/issues/2) and [building distribution packages](https://github.com/f1yn/cockpit-ultralight/issues/1).

## Using

<s>I recommend using the `Use as template` button located near the top of the repo, otherwise you can manually create a new project locally by running:</s>

Until this project is fully stabilized (as I'm going to be adding features), it's recommended you setup a git repo manually. The easiest way to do this would be to fork the repository, and creating a different primary branch.

1. Fork the repo
2. Clone the repo locally
3. `git branch -m main template` will move this upstream to `template`
4. `git branch -b main` will create a main branch, that's based on template
5. `git push` will sync your repo, assuming you've already setup git

Documentation for the other way to do this (manually creating a repo with a upstream) is coming soon, but multiple git origins is always a bit wonky to explain.

## Setting up (any Linux)

> I recommend using [fmn](https://github.com/Schniz/fnm) install for installing nodejs. It enables building more nodejs/npm projects in different shells. Otherwise, (Fedora) `sudo dnf install nodejs npm` (or equivalent on your Linux distribution).

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

## Example

**Without adding anything new, you'll be gretted by a screen like this:**

-   A simple screen build using patternfly components
-   A statically loaded image
-   A live preview of the current contents of `/etc/hostname`
-   A stored output of the latest execution of the `hostnamectl` (in a user shell)

<img width="1207" alt="Screenshot 2024-03-25 131525" src="https://github.com/f1yn/cockpit-ultralight/assets/6565187/5766547b-8a24-4911-a48d-f68ebaf7a906">

**With dark mode:**

<img width="1207" alt="Screenshot 2024-03-25 154706" src="https://github.com/f1yn/cockpit-ultralight/assets/6565187/18894618-81f5-4c77-a0fa-3dec21700a26">


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
