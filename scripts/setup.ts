// Interactive (or flag-driven) project setup for this cockpit plugin template.
//
// Collects the three mechanical values a new plugin must decide — package/project name,
// cockpit menu title, and minimum cockpit version — writes them into `package.json` and
// `static/manifest.json`, then installs dependencies and refreshes the vendored cockpit
// types. Building and linking are printed as next steps.
//
// The README is deliberately out of scope: rebranding prose is the `setup` agent skill's
// job, not a script's.
//
// `npm run setup -- --help` documents every flag. Without flags it prompts, which is what a
// human wants; the flags are what the `setup` agent skill uses.
// Contract: `.agents/skills/setup/SKILL.md`. The cockpit version is a bare number (see
// README "Compatibility: `requires.cockpit` is a bare version").

import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineCommand, runMain } from 'citty';
import type { ArgsDef } from 'citty';

import {
	assertNoUnknownFlags,
	handleError,
	printPlan,
	resolveFields,
} from './shared/cli.ts';
import { run } from './shared/process.ts';
import {
	MANIFEST_PATH,
	PACKAGE_JSON_PATH,
	PROJECT_ROOT,
	readJson,
	writeJsonAtomic,
} from './shared/project.ts';

const PACKAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const COCKPIT_VERSION_PATTERN = /^\d+(\.\d+)*$/;
const MAX_TITLE_LENGTH = 80;
const MAX_NAME_LENGTH = 64;

// `package.json` subset this script reads and writes.
interface PackageJson {
	name: string;
	[key: string]: unknown;
}

// `static/manifest.json` subset this script reads and writes.
interface CockpitManifest {
	requires?: Record<string, string>;
	tools?: Record<string, { label?: string } & Record<string, unknown>>;
	[key: string]: unknown;
}

// Everything the setup decides.
interface SetupValues {
	readonly name: string;
	readonly title: string;
	readonly cockpit: string;
}

// Validates a project/package name, or explains why it is unusable.
function validateName(value: string): string {
	const name = value.trim();
	if (!PACKAGE_NAME_PATTERN.test(name) || name.length > MAX_NAME_LENGTH) {
		throw new Error(
			`invalid project name "${value}": use lowercase letters, digits, dot, dash or underscore (max ${MAX_NAME_LENGTH} chars)`,
		);
	}
	return name;
}

// Validates the cockpit menu title.
function validateTitle(value: string): string {
	const title = value.trim();
	if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
		throw new Error(
			`invalid menu title: must be 1-${MAX_TITLE_LENGTH} characters`,
		);
	}
	if (/[\u0000-\u001f\u007f]/.test(title)) {
		throw new Error(
			'invalid menu title: control characters are not allowed',
		);
	}
	return title;
}

// Validates the minimum cockpit version (bare number, no operators).
function validateCockpitVersion(value: string): string {
	const version = value.trim();
	if (!COCKPIT_VERSION_PATTERN.test(version)) {
		throw new Error(
			`invalid cockpit version "${value}": cockpit compares requires.cockpit as a bare version ` +
				'(for example "360"), never an operator such as ">= 360" — see README ' +
				'"Compatibility: requires.cockpit is a bare version"',
		);
	}
	return version;
}

// Resolves the three values: flags first, prompts for whatever is missing.
async function resolveValues(
	given: {
		name?: string | undefined;
		title?: string | undefined;
		cockpit?: string | undefined;
	},
	current: { name: string; title: string; cockpit: string },
	assumeYes: boolean,
): Promise<SetupValues> {
	const values = await resolveFields(
		[
			{
				key: 'name',
				given: given.name,
				question: 'Project name',
				fallback: current.name,
				required: true,
			},
			{
				key: 'title',
				given: given.title,
				question: 'Cockpit menu title',
				fallback: current.title,
				required: true,
			},
			{
				key: 'cockpit',
				given: given.cockpit,
				question: 'Minimum cockpit version',
				fallback: current.cockpit,
				required: true,
			},
		],
		assumeYes,
		'pass --name/--title/--cockpit, or run `npm run setup` in a terminal for prompts',
	);

	return {
		name: validateName(values.name),
		title: validateTitle(values.title),
		cockpit: validateCockpitVersion(values.cockpit),
	};
}

// Refuses to overwrite files with uncommitted changes (keep changes reversible).
// Returns early when git is unavailable: there is nothing to protect.
function assertTargetsClean(allowDirty: boolean, paths: string[]): void {
	const result = run('git', ['status', '--porcelain', '--', ...paths], {
		cwd: PROJECT_ROOT,
		capture: true,
		quiet: true,
		required: false,
	});
	if (!result.ok || result.stdout === '' || allowDirty) return;
	throw new Error(
		`${paths.join(', ')} has uncommitted changes; commit or stash them first ` +
			'(or pass --allow-dirty) so this setup step stays reversible',
	);
}

// Installs dependencies, but only when node_modules is absent.
function ensureDependencies(install: boolean): void {
	if (!install) return;
	if (existsSync(path.join(PROJECT_ROOT, 'node_modules'))) return;
	console.log('· installing dependencies');
	run('npm', ['install'], { cwd: PROJECT_ROOT, label: 'npm install' });
}

// Refreshes the vendored cockpit types when the offline gate reports drift.
function ensureVendoredTypes(): void {
	const check = run(
		'npm',
		['run', '--silent', 'sync:cockpit-types', '--', '--check'],
		{ cwd: PROJECT_ROOT, required: false },
	);
	if (check.ok) return;

	console.log(
		'· vendored cockpit types are missing or stale; syncing from the pinned commit',
	);
	run('npm', ['run', '--silent', 'sync:cockpit-types'], {
		cwd: PROJECT_ROOT,
		label: 'cockpit types sync',
	});
}

// The command's flag surface: citty renders --help from it, and the unknown-flag guard
// reads it, so there is exactly one declaration.
const setupArgs = {
	name: { type: 'string', description: 'Project name (lowercase slug)' },
	title: { type: 'string', description: 'Cockpit menu title' },
	cockpit: {
		type: 'string',
		description: 'Minimum cockpit version, bare number (e.g. 360)',
	},
	yes: {
		type: 'boolean',
		default: false,
		description: 'Non-interactive: fail instead of prompting',
	},
	'dry-run': {
		type: 'boolean',
		default: false,
		description: 'Print the plan and write nothing',
	},
	'allow-dirty': {
		type: 'boolean',
		default: false,
		description: 'Allow uncommitted target files',
	},
	install: {
		type: 'boolean',
		default: true,
		description: 'Run npm install when node_modules is absent',
		negativeDescription: 'Skip npm install',
	},
} satisfies ArgsDef;

const main = defineCommand({
	meta: {
		name: 'setup',
		description:
			'Set the project name, cockpit menu title, minimum cockpit version and README',
	},
	args: setupArgs,
	async run({ args }) {
		try {
			assertNoUnknownFlags(args, setupArgs);

			const packageJson = await readJson<PackageJson>(PACKAGE_JSON_PATH);
			const manifest = await readJson<CockpitManifest>(MANIFEST_PATH);

			const current = {
				name: packageJson.name,
				title: manifest.tools?.index?.label ?? packageJson.name,
				cockpit: manifest.requires?.cockpit ?? '360',
			};

			const values = await resolveValues(
				{
					name: args.name,
					title: args.title,
					cockpit: args.cockpit,
				},
				current,
				args.yes,
			);

			const change = (from: string, to: string): string =>
				from === to ? `${to} (unchanged)` : `${from} -> ${to}`;

			console.log('Setup plan:');
			printPlan([
				['project name', change(current.name, values.name)],
				['menu title', change(current.title, values.title)],
				['cockpit min', change(current.cockpit, values.cockpit)],
			]);

			if (args['dry-run']) {
				console.log('· dry run: nothing written');
				return;
			}

			assertTargetsClean(args['allow-dirty'], [
				'package.json',
				'static/manifest.json',
			]);

			packageJson.name = values.name;
			manifest.requires = {
				...manifest.requires,
				cockpit: values.cockpit,
			};
			manifest.tools = {
				...manifest.tools,
				index: { ...manifest.tools?.index, label: values.title },
			};

			await writeJsonAtomic(PACKAGE_JSON_PATH, packageJson);
			await writeJsonAtomic(MANIFEST_PATH, manifest);
			console.log('· wrote package.json and static/manifest.json');

			ensureDependencies(args.install);
			ensureVendoredTypes();

			console.log(
				'\nNext steps:\n' +
					'  npm run build       production build into dist/\n' +
					'  npm run link:local  symlink dist/ into ~/.local/share/cockpit\n' +
					`  npm run check       format, types, vendored-type drift, build`,
			);
			console.log(
				`Once linked, open cockpit and look for "${values.title}".`,
			);
		} catch (error) {
			handleError(error);
		}
	},
});

await runMain(main);
