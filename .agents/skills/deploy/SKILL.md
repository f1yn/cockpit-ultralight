---
name: deploy
description: Publish the built cockpit plugin to a remote host by mirroring dist/ into its ~/.local/share/cockpit directory over SSH with rsync. Use when the user asks to deploy, publish, push, sync, or ship the plugin to a cockpit host.
---

# Deploy

Drives `scripts/deploy.ts` (`npm run deploy`). Same shape as the `setup` skill: the
script does the work, this skill supplies the target and verifies the result.

## 1. Gather the target

| Value            | Flag       | Notes                                                   |
| ---------------- | ---------- | ------------------------------------------------------- |
| SSH target       | `--target` | `user@host`; **required**, never guess                  |
| Remote directory | `--path`   | defaults to `$HOME/.local/share/cockpit/<package name>` |
| SSH port         | `--port`   | only when the host is not on 22                         |

**`rsync` is required** — there is no fallback transport. If it is missing the script fails
with `rsync is required to deploy`. On macOS the system `rsync` (openrsync) works.

The default directory is correct for a per-user cockpit install; that is the same path
`npm run link:local` creates locally. Use `--path /usr/share/cockpit/<name>` only when the
user explicitly wants a system-wide install (that usually needs root on the host).

**If the target is not in the user's request, ask for it with `ask_user`** — one question,
freeform, for example: "Which host should I deploy to? (`user@host`)". Do not infer a host
from SSH config, shell history, or a previous session.

Hard rules:

- **Never pass `--force`.** It exists to bypass the "directory does not end with the
  project name" guard before `rsync --delete`; a human decides that, not you.
- Never add credentials. The script assumes key-based SSH that already works; if SSH
  prompts for a password, stop and tell the user.
- Keep the mirror default (`--delete`). `--no-delete` is for deliberately additive copies.

## 2. Preview, then apply

`npm run deploy -- --help` is the authoritative flag list; the commands below are the
contract this skill depends on.

```sh
npm run deploy -- --target <user@host> --dry-run
```

`rsync --dry-run` lists the files it would transfer and touches nothing, so this is the
safe first step for every deploy. Show the user the file list, then apply:

```sh
npm run deploy -- --target <user@host> --yes
```

The script refuses to run when `dist/` is incomplete — if it reports that, run
`npm run build` (or `npm run check`) first and retry.

## 3. Verify

The script already compares the remote file count with `dist/` and fails on a mismatch.
To confirm cockpit itself sees the plugin on the host:

```sh
ssh <user@host> cockpit-bridge --packages
```

The package should be listed with its menu label and no `required cockpit version … not
met` warning. Mention that the user may need to reload cockpit (or log out and in) before
the menu entry appears.

## On failure

Report the script's message verbatim and stop. Do not retry with `--force`, do not edit
the remote directory by hand to work around an error — report what failed and let the user
decide.
