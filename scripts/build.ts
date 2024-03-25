import esbuild, { Plugin } from 'esbuild';
import { cleanAndCopyPlugin, skipPatternflyStyles, watchStaticDirPlugin } from './buildPlugins';

// Setup some environment flags for readability
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = !isDevelopment;

// Create the build context using Esbuild
// https://esbuild.github.io/api/#build
const context = await esbuild.context({
    // We are targeting esm for the ability to dynamic import using esbuild
    // Cockpit only supports browser versions with existing support for import() and es modules
    // https://cockpit-project.org/running.html
    // https://caniuse.com/es6-module-dynamic-import
    format: 'esm',
    target: ["es2020"],
    bundle: true,
    splitting: true,
    entryPoints: ['./src/app.tsx', './src/init.ts'],
    outdir: './dist',
    // Environment specific configurations
    metafile: isProduction,
    minify: isProduction,
    sourcemap: isDevelopment,
    logLevel: isDevelopment ? 'info' : 'error',
    plugins: [
        // in static and dev builds, make sure we clean and populate dist with the files in static
        cleanAndCopyPlugin,
        // We inherit styles from the parent cockpit window, so we don't need to bundle patternfly styles
        // if you do diverge from from the patternfly version from cockpit, removing this plugin will bundle
        // patternfly app styles
        skipPatternflyStyles,
        // copies static files (again) when they're modified in development
        isDevelopment && watchStaticDirPlugin
    ].filter(Boolean) as Plugin[],
});


if (isDevelopment) {
    // Enter watching mode
    await context.watch();
} else {
    // Single build iteration (reutilize context here so we don't need to pass an object around)
    const result = await context.rebuild();
    // Print the build results
    console.log(await esbuild.analyzeMetafile(result.metafile!, {
        verbose: true,
    }))
    // Immediately close the context since we aren't using it anymore
    context.dispose();
}
