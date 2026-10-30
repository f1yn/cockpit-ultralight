// esbuild build for this cockpit plugin.
//
// Sourcemap policy: maps are emitted for development builds only; production never writes
// `.map` files into the shipped plugin directory.

import esbuild from 'esbuild';
import path from 'node:path';

import { buildPlugins } from './buildPlugins.ts';
import { DIST_DIR, SRC_DIR } from './shared/project.ts';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = !isDevelopment;

const context = await esbuild.context({
	// ESM target: cockpit only supports browsers with import() and ES modules.
	// https://cockpit-project.org/running.html
	format: 'esm',
	target: ['es2020'],
	bundle: true,
	splitting: true,
	entryPoints: [path.join(SRC_DIR, 'app.tsx'), path.join(SRC_DIR, 'init.ts')],
	outdir: DIST_DIR,
	metafile: isProduction,
	minify: isProduction,
	sourcemap: isDevelopment,
	logLevel: isDevelopment ? 'info' : 'error',
	plugins: buildPlugins(isDevelopment),
	// Lets esbuild drop the dev-only branches below (and in src/init.ts).
	define: {
		'process.env.NODE_ENV': JSON.stringify(
			process.env.NODE_ENV || 'production',
		),
	},
});

if (isDevelopment) {
	await context.watch();
} else {
	const result = await context.rebuild();
	// The metafile only exists for production builds.
	if (result.metafile) {
		console.log(
			await esbuild.analyzeMetafile(result.metafile, { verbose: true }),
		);
	}
	await context.dispose();
}
