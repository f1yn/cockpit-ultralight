// esbuild plugins for this cockpit plugin.
//
// `buildPlugins()` is the single list the build consumes: it decides which plugins run in
// which mode, so build.ts only has to call it.

import type { Plugin } from 'esbuild';
import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { DIST_DIR, STATIC_DIR } from './shared/project.ts';

// Cleans `dist/` and copies `static/` into it at build start.
export const cleanAndCopyPlugin: Plugin = {
	name: 'copy',
	async setup() {
		// Only run this once at startup.
		await cleanDistDirectory();
		await copyStaticDirectory();
	},
};

// Skips PatternFly core styles: they are inherited from the parent cockpit window. Covers
// both PF5 and PF6 stylesheet layouts. Drop this only if you bundle PatternFly yourself.
export const skipPatternflyStyles: Plugin = {
	name: 'skip-patternfly-styles',
	setup(build) {
		build.onLoad({ filter: /@patternfly\/.+\.css$/ }, () => {
			return { contents: '', loader: 'css' };
		});
	},
};

// Re-copies `static/` into `dist/` whenever watched files change (development only).
export const watchStaticDirPlugin: Plugin = {
	name: 'watch-static',
	setup(build) {
		// Hook the entry point once, then hand esbuild the static tree to watch.
		build.onLoad({ filter: /app\.tsx$/ }, async (entry) => {
			const staticFiles = await scanStaticDirectory();
			return {
				// Watching dirs also catches new files and deletions.
				watchDirs: [STATIC_DIR, ...staticFiles.watchDirs],
				watchFiles: [entry.path, ...staticFiles.watchFiles],
			};
		});

		build.onEnd(async () => {
			await copyStaticDirectory();
		});
	},
};

// The plugin list for a build, in one place.
export function buildPlugins(isDevelopment: boolean): Plugin[] {
	return [
		cleanAndCopyPlugin,
		skipPatternflyStyles,
		...(isDevelopment ? [watchStaticDirPlugin] : []),
	];
}

// Partitions the static tree into directories and files, as absolute paths.
async function scanStaticDirectory(): Promise<{
	watchDirs: string[];
	watchFiles: string[];
}> {
	const baseFiles = await fs.readdir(STATIC_DIR, {
		recursive: true,
		withFileTypes: true,
	});

	const directories: Dirent[] = [];
	const files = baseFiles.filter((fileRef) => {
		if (fileRef.isDirectory()) directories.push(fileRef);
		return true;
	});

	// `parentPath` is the typed Dirent directory accessor (the old `path` is gone in Node 26).
	const toAbsolutePath = (file: Dirent): string =>
		path.join(file.parentPath, file.name);

	return {
		watchDirs: directories.map(toAbsolutePath),
		watchFiles: files.map(toAbsolutePath),
	};
}

async function cleanDistDirectory(): Promise<void> {
	await fs.rm(DIST_DIR, { recursive: true, force: true });
	await fs.mkdir(DIST_DIR);
}

async function copyStaticDirectory(): Promise<void> {
	await fs.cp(STATIC_DIR, DIST_DIR, { recursive: true });
}
