// Shared subprocess helpers. Nothing here builds shell strings: every call is an argv
// array, which is what keeps quoting bugs out of these scripts.

import { spawnSync } from 'node:child_process';

// Outcome of a command. `ok` is false for a non-zero exit or a spawn error.
export interface RunResult {
	readonly ok: boolean;
	readonly status: number | null;
	readonly stdout: string;
}

// True when a command is available on PATH.
export function hasCommand(command: string): boolean {
	return spawnSync('which', [command], { stdio: 'ignore' }).status === 0;
}

// Runs a command. `required` (default) throws on failure; pass false for probes and gates.
// `capture` collects stdout, `quiet` also silences stderr. This is the only spawn site.
export function run(
	command: string,
	args: string[],
	options: {
		cwd?: string | undefined;
		capture?: boolean | undefined;
		quiet?: boolean | undefined;
		label?: string | undefined;
		required?: boolean | undefined;
	} = {},
): RunResult {
	const result = spawnSync(command, args, {
		cwd: options.cwd,
		stdio: options.capture
			? ['ignore', 'pipe', options.quiet ? 'ignore' : 'inherit']
			: 'inherit',
		encoding: 'utf8',
	});
	const outcome: RunResult = {
		ok: !result.error && result.status === 0,
		status: result.status,
		stdout: (result.stdout ?? '').trim(),
	};

	if (!outcome.ok && options.required !== false) {
		throw new Error(
			`${options.label ?? command} failed (exit ${outcome.status ?? 'unknown'})`,
		);
	}
	return outcome;
}
