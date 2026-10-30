// Shared CLI helpers for the scripts in this directory.

import type { ArgsDef } from 'citty';
import { createInterface } from 'node:readline/promises';

// One value a command needs: where it may come from, and what to ask.
export interface FieldSpec {
	readonly key: string;
	readonly given: string | undefined;
	readonly question: string;
	readonly fallback: string;
	readonly required?: boolean;
}

// True when prompts should be shown: a terminal, and --yes was not passed.
export function isInteractive(assumeYes: boolean): boolean {
	return !assumeYes && Boolean(process.stdin.isTTY);
}

// Resolves every field at once: flags win, a terminal prompts for the rest, and a
// non-interactive run fails closed if a required value is missing. This is the only
// place that decides between "ask" and "fail".
export async function resolveFields(
	fields: readonly FieldSpec[],
	assumeYes: boolean,
	hint: string,
): Promise<Record<string, string>> {
	const missing = fields
		.filter(
			(field) => field.required !== false && field.given === undefined,
		)
		.map((field) => field.key);

	if (!isInteractive(assumeYes)) {
		if (missing.length > 0) {
			throw new Error(
				`missing required value(s): ${missing.join(', ')} — ${hint}`,
			);
		}
		return Object.fromEntries(
			fields.map((field) => [field.key, field.given ?? field.fallback]),
		);
	}

	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	const ask = async (field: FieldSpec): Promise<string> => {
		if (field.given !== undefined) return field.given;
		const suffix = field.fallback.length > 0 ? ` [${field.fallback}]` : '';
		const answer = (
			await rl.question(`${field.question}${suffix}: `)
		).trim();
		return answer.length > 0 ? answer : field.fallback;
	};

	try {
		const values: Record<string, string> = {};
		for (const field of fields) values[field.key] = await ask(field);
		return values;
	} finally {
		rl.close();
	}
}

// citty's parser accepts unknown flags. The accepted names come from the command's own
// `args` definition, so there is no second list to keep in sync.
export function assertNoUnknownFlags(
	args: Record<string, unknown>,
	definitions: ArgsDef,
): void {
	const toCamel = (name: string): string =>
		name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
	const allowed = new Set(
		Object.keys(definitions).flatMap((flag) => [flag, toCamel(flag)]),
	);

	for (const key of Object.keys(args)) {
		if (key === '_' || key === '$0') continue;
		if (!allowed.has(key) && !allowed.has(toCamel(key))) {
			throw new Error(`unknown argument: --${key}`);
		}
	}
}

// Uniform "what will this do" summary, shared so both scripts line up the same way.
export function printPlan(
	rows: ReadonlyArray<readonly [string, string]>,
): void {
	const width = Math.max(...rows.map(([label]) => label.length));
	for (const [label, value] of rows) {
		console.log(`  ${label.padEnd(width)}  ${value}`);
	}
}

// Uniform failure path: print the message, no stack, non-zero exit.
export function handleError(error: unknown): void {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
