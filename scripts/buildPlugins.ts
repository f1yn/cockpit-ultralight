import { Plugin } from 'esbuild';
import { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

// Let's give ourselves some absolute paths (relative to the one we are in)
const distDirectoryAbsolute = path.resolve(import.meta.dirname, '../dist');
const staticDirectoryAbsolute = path.resolve(import.meta.dirname, '../static');

// Cleans dist, and also copies the files from static to dist when a build starts (initial copy)
export const cleanAndCopyPlugin: Plugin = {
    name: 'copy',
    async setup() {
        // Only run this once at startup!
        await cleanDistDirectory();
        await copyStaticDirectory();
    }
}

// skip patternfly core styles (because we inherit styles from the parent window)
export const skipPatternflyStyles: Plugin = {
    name: 'skip-patternfly-styles',
    setup(build) {
        build.onLoad({ filter: /@patternfly\/react-styles\/.+\.css$/ }, (args) => {
            return {
                contents: '',
                loader: 'css',
            }
        })
    }
}

// In development builds, make sure that we watch the static files and copy them over if they are changed
export const watchStaticDirPlugin: Plugin = {
    name: 'watch-static',
    setup(build) {
        // Workaround - waits for the entrypoint file (only executes once when the file is loaded into memory)
        build.onLoad({ filter: /app\.tsx$/ }, async (entry) => {
            // scan the directory for known static files
            const staticFiles = await scanStaticDirectory();

            return {
                // Watch the static directory and files - this seems to detect new files as well as deletions
                // which is surprising, the majority of file watching tools seem to not do that. 
                watchDirs: [staticDirectoryAbsolute, ...staticFiles.watchDirs],
                // Make sure we continue to watch the entry file as well
                watchFiles: [entry.path, ...staticFiles.watchFiles]
            }
        });

        // Perform the copy after each build
        build.onEnd(async () => {
            await copyStaticDirectory();
        });
    },
}

async function scanStaticDirectory() {
    const baseFiles = await fs.readdir(staticDirectoryAbsolute, { recursive: true, withFileTypes: true });

    // partition the static files form their directories (if present)
    const watchDirs: Dirent[] = [];
    const watchFiles = baseFiles.filter(fileRef => {
        if (!fileRef.isDirectory()) return true;
        watchDirs.push(fileRef);
        return true;
    })

    // Map out the files to their absolute representation
    const toAbsolutePath = file => path.join(file.path, file.name);
    return {
        watchDirs: watchDirs.map(toAbsolutePath),
        watchFiles: watchFiles.map(toAbsolutePath),
    }
}

async function cleanDistDirectory() {
    // Create dist directory
    await fs.rm(distDirectoryAbsolute, { recursive: true });
    await fs.mkdir(distDirectoryAbsolute);
}

async function copyStaticDirectory() {
    // copy files
    await fs.cp(staticDirectoryAbsolute, distDirectoryAbsolute, { recursive: true })
}