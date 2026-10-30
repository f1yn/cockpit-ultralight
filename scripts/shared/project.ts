// Shared paths and file helpers for the scripts in this directory. Every path a script
// needs is declared here once: no script derives its own copy.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
export const SRC_DIR = path.join(PROJECT_ROOT, 'src');
export const STATIC_DIR = path.join(PROJECT_ROOT, 'static');
export const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
export const VENDOR_DIR = path.join(PROJECT_ROOT, 'vendor', 'cockpit-types');
export const PROVENANCE_PATH = path.join(VENDOR_DIR, 'provenance.json');
export const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');
export const MANIFEST_PATH = path.join(STATIC_DIR, 'manifest.json');
export const README_PATH = path.join(PROJECT_ROOT, 'README.md');

// Reads and parses a JSON file, keeping a readable error on failure.
export async function readJson<T>(filePath: string): Promise<T> {
	try {
		return JSON.parse(await readFile(filePath, 'utf8')) as T;
	} catch (error) {
		throw new Error(
			`cannot read ${path.relative(PROJECT_ROOT, filePath)}: ${String(error)}`,
		);
	}
}

// Writes a file atomically (temp file + rename), creating parent directories as needed.
export async function writeAtomic(
	filePath: string,
	contents: string,
): Promise<void> {
	const tempPath = `${filePath}.tmp-${process.pid}`;
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(tempPath, contents, 'utf8');
	await rename(tempPath, filePath);
}

// Writes JSON with the repository's tab indentation, atomically.
export async function writeJsonAtomic(
	filePath: string,
	value: unknown,
): Promise<void> {
	await writeAtomic(filePath, `${JSON.stringify(value, null, '\t')}\n`);
}

// The package name, which seeds the default cockpit directory.
export async function readProjectName(): Promise<string> {
	const packageJson = await readJson<{ name?: unknown }>(PACKAGE_JSON_PATH);
	if (typeof packageJson.name !== 'string' || packageJson.name.length === 0) {
		throw new Error('package.json has no usable "name"');
	}
	return packageJson.name;
}
