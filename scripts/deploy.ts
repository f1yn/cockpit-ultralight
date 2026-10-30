// Publishes the built plugin to a cockpit host over SSH.
//
// Mirrors `dist/` into the remote cockpit package directory — the remote equivalent of
// what `npm run link:local` does on this machine. Requires `rsync` plus `ssh` with working
// key-based access to the target; no credentials are read or stored.
//
// `npm run deploy -- --help` documents every flag. `--target` is required; without it the
// script prompts (human) or fails closed (agent). Contract: `.agents/skills/deploy/SKILL.md`.

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { defineCommand, runMain } from 'citty';
import type { ArgsDef } from 'citty';

import {
	assertNoUnknownFlags,
	handleError,
	printPlan,
	resolveFields,
} from './shared/cli.ts';
import { hasCommand, run } from './shared/process.ts';
import { DIST_DIR, PROJECT_ROOT, readProjectName } from './shared/project.ts';

const TARGET_PATTERN = /^(?:[A-Za-z0-9._-]+@)?[A-Za-z0-9.-]+$/;

// Resolved deploy plan.
interface DeployPlan {
	readonly target: string;
	readonly remotePath: string;
	readonly port?: string;
}

// Resolves the target from flags, then prompts, then fails closed.
async function resolvePlan(
	given: {
		target?: string | undefined;
		remotePath?: string | undefined;
		port?: string | undefined;
	},
	options: { mirror: boolean; force: boolean },
	projectName: string,
	assumeYes: boolean,
): Promise<DeployPlan> {
	const values = await resolveFields(
		[
			{
				key: 'target',
				given: given.target,
				question: 'Remote host (user@host)',
				fallback: 'flynn@localhost',
				required: true,
			},
			{
				key: 'remotePath',
				given: given.remotePath,
				question: 'Remote cockpit directory',
				fallback: `$HOME/.local/share/cockpit/${projectName}`,
				required: false,
			},
		],
		assumeYes,
		'pass --target user@host, or run `npm run deploy` in a terminal for prompts',
	);

	const target = values.target;
	if (!TARGET_PATTERN.test(target)) {
		throw new Error(
			`invalid target "${target}": expected user@host (letters, digits, dot, dash, underscore)`,
		);
	}

	const remotePath = values.remotePath;
	if (remotePath.trim().length === 0) {
		throw new Error('remote path must not be empty');
	}

	if (given.port !== undefined && !/^\d+$/.test(given.port)) {
		throw new Error(`invalid --port "${given.port}": expected a number`);
	}

	// A mirror into an unexpected directory is the one mistake worth refusing.
	const mirrorsIntoProject = remotePath
		.replace(/\/+$/, '')
		.endsWith(`/${projectName}`);
	if (options.mirror && !mirrorsIntoProject && !options.force) {
		throw new Error(
			`refusing to run rsync --delete into "${remotePath}": it does not end with ` +
				`"/${projectName}". Pass --no-delete to copy without removing, or --force to override`,
		);
	}

	return {
		target,
		remotePath,
		...(given.port === undefined ? {} : { port: given.port }),
	};
}

// Fails closed unless a complete production build exists.
function assertBuildIsComplete(): void {
	for (const required of ['manifest.json', 'app.js']) {
		if (!existsSync(path.join(DIST_DIR, required))) {
			throw new Error(
				`dist/${required} is missing; run \`npm run build\` first`,
			);
		}
	}
	if (readdirSync(DIST_DIR).length === 0) {
		throw new Error('dist/ is empty; refusing to publish');
	}
}

// The ssh argument list, including an explicit port when given.
function sshArgs(plan: DeployPlan): string[] {
	return [...(plan.port === undefined ? [] : ['-p', plan.port]), plan.target];
}

// Mirrors `dist/` to the target.
function transfer(plan: DeployPlan, mirror: boolean, dryRun: boolean): void {
	run(
		'rsync',
		[
			'--archive',
			'--verbose',
			...(mirror ? ['--delete'] : []),
			...(dryRun ? ['--dry-run'] : []),
			...(plan.port === undefined ? [] : ['-e', `ssh -p ${plan.port}`]),
			`${DIST_DIR}/`,
			`${plan.target}:${plan.remotePath}/`,
		],
		{ label: 'rsync' },
	);
}

// Compares the remote file count with the local build; a drift means a partial sync.
function verifyRemote(plan: DeployPlan): void {
	const localCount = readdirSync(DIST_DIR).length;
	const output = run(
		'ssh',
		[
			...sshArgs(plan),
			`find "${plan.remotePath}" -maxdepth 1 -type f | wc -l`,
		],
		{ label: 'ssh verify', capture: true },
	).stdout;
	const remoteCount = Number.parseInt(output, 10);

	if (!Number.isFinite(remoteCount)) {
		console.warn(
			`· could not parse remote file count (${JSON.stringify(output)})`,
		);
		return;
	}
	if (remoteCount !== localCount) {
		throw new Error(
			`remote directory holds ${remoteCount} file(s) but dist/ holds ${localCount}; the mirror did not complete`,
		);
	}
	console.log(`· verified ${remoteCount} file(s) on ${plan.target}`);
}

// The command's flag surface: citty renders --help from it, and the unknown-flag guard
// reads it, so there is exactly one declaration.
const deployArgs = {
	target: {
		type: 'string',
		description: 'SSH target, user@host (prompted when omitted)',
	},
	path: {
		type: 'string',
		description:
			'Remote directory (default $HOME/.local/share/cockpit/<name>)',
	},
	port: { type: 'string', description: 'SSH port (default 22)' },
	yes: {
		type: 'boolean',
		default: false,
		description: 'Non-interactive: fail instead of prompting',
	},
	'dry-run': {
		type: 'boolean',
		default: false,
		description: 'List what would transfer and write nothing',
	},
	delete: {
		type: 'boolean',
		default: true,
		description: 'Mirror with rsync --delete',
		negativeDescription: 'Copy without removing remote files',
	},
	verify: {
		type: 'boolean',
		default: true,
		description: 'Compare the remote file count with dist/',
		negativeDescription: 'Skip the remote file-count check',
	},
	force: {
		type: 'boolean',
		default: false,
		description: 'Override the "path must end with the project name" guard',
	},
} satisfies ArgsDef;

const main = defineCommand({
	meta: {
		name: 'deploy',
		description: 'Mirror dist/ into a cockpit host over SSH with rsync',
	},
	args: deployArgs,
	async run({ args }) {
		try {
			assertNoUnknownFlags(args, deployArgs);

			if (!hasCommand('rsync')) {
				throw new Error(
					'rsync is required to deploy; install it and re-run',
				);
			}

			const projectName = await readProjectName();
			assertBuildIsComplete();

			const mirror = args.delete;
			const plan = await resolvePlan(
				{ target: args.target, remotePath: args.path, port: args.port },
				{ mirror, force: args.force },
				projectName,
				args.yes,
			);
			const destination = `${plan.target}:${plan.remotePath}/`;

			console.log('Deploy plan:');
			printPlan([
				['target', plan.target],
				['directory', plan.remotePath],
				[
					'mode',
					mirror ? 'mirror (rsync --delete)' : 'copy (no deletion)',
				],
			]);

			if (args['dry-run']) {
				// rsync --dry-run reports the remote directory it would create, without creating it.
				transfer(plan, mirror, true);
				return;
			}

			run('ssh', [...sshArgs(plan), `mkdir -p -- "${plan.remotePath}"`], {
				label: 'ssh mkdir',
			});
			transfer(plan, mirror, false);
			if (args.verify) verifyRemote(plan);
			console.log(
				`· published ${path.relative(PROJECT_ROOT, DIST_DIR)}/ -> ${destination}`,
			);
		} catch (error) {
			handleError(error);
		}
	},
});

await runMain(main);
