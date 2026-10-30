// Syncs the vendored Cockpit JS API type surface (`pkg/lib/cockpit.d.ts` and its
// type-import closure) from the pinned upstream commit into `vendor/cockpit-types/`.
//
// Modes:
// - Default (network): fetches upstream files at `PINNED_REF` (or `--ref <ref>`), walks the
//   relative-import closure with the TypeScript compiler API, writes the files verbatim
//   (temp-file + rename), then (re)writes `provenance.json` with the upstream ref, release
//   anchor, and a sha256 per file. Nothing else is touched.
// - `--check` (offline, wired into `npm run check`): recomputes sha256 for every file
//   recorded in `provenance.json` and fails closed on any mismatch, missing file, bad
//   manifest, or structural drift. This is also what rejects hand edits to vendored files.
//
// Contract & rationale: .pi/plans/cockpit-ultralight-modernize.md (D1).

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

import { handleError } from './shared/cli.ts';
import {
	PROVENANCE_PATH,
	VENDOR_DIR,
	readJson,
	writeAtomic,
} from './shared/project.ts';

const UPSTREAM_REPO = 'cockpit-project/cockpit';
const UPSTREAM_ENTRY = 'pkg/lib/cockpit.d.ts';
const NEUTERED_BARE_IMPORTS = new Set(['_internal/common']);
const MAX_CLOSURE_FILES = 20;
const CANDIDATE_EXTENSIONS = ['.ts', '.d.ts', '.tsx'] as const;

// Upstream commit the vendored snapshot is pinned to.
const PINNED_REF = '2034c57b761aa5a35f12e064a494a7b53358efda';

// Provenance record written next to the vendored tree.
interface ProvenanceManifest {
	upstream_repo: string;
	upstream_ref: string;
	upstream_version: string | null;
	files: Record<string, string>;
}

// Resolves a branch/tag/sha to a full 40-character commit sha.
async function resolveRef(ref: string): Promise<string> {
	if (/^[0-9a-f]{40}$/.test(ref)) return ref;

	const response = await fetch(
		`https://api.github.com/repos/${UPSTREAM_REPO}/commits/${ref}`,
		{ headers: githubHeaders() },
	);
	if (!response.ok) {
		throw new Error(
			`Unable to resolve upstream ref "${ref}" (HTTP ${response.status})`,
		);
	}
	const payload = (await response.json()) as { sha?: unknown };
	if (typeof payload.sha !== 'string') {
		throw new Error(
			`Upstream ref "${ref}" did not resolve to a commit sha`,
		);
	}
	return payload.sha;
}

// Builds request headers, reusing a token only if the caller provided one.
function githubHeaders(): Record<string, string> {
	const token = process.env.GITHUB_TOKEN;
	if (!token) return { accept: 'application/vnd.github+json' };
	return {
		accept: 'application/vnd.github+json',
		authorization: `Bearer ${token}`,
	};
}

// Returns the upstream file text, or throws when it does not exist.
async function fetchUpstreamText(
	sha: string,
	pkgPath: string,
): Promise<string> {
	const response = await fetch(
		`https://raw.githubusercontent.com/${UPSTREAM_REPO}/${sha}/${pkgPath}`,
	);
	if (!response.ok) {
		throw new Error(
			`Unable to fetch ${pkgPath} at ${sha} (HTTP ${response.status})`,
		);
	}
	return response.text();
}

// Fetches the upstream file, returning `null` for a 404.
async function fetchOptionalUpstreamText(
	sha: string,
	pkgPath: string,
): Promise<string | null> {
	const response = await fetch(
		`https://raw.githubusercontent.com/${UPSTREAM_REPO}/${sha}/${pkgPath}`,
	);
	if (response.status === 404) return null;
	if (!response.ok) {
		throw new Error(
			`Unable to fetch ${pkgPath} at ${sha} (HTTP ${response.status})`,
		);
	}
	return response.text();
}

// Collects every module specifier referenced by import/export declarations.
function collectImportSpecifiers(fileName: string, text: string): string[] {
	const sourceFile = ts.createSourceFile(
		fileName,
		text,
		ts.ScriptTarget.Latest,
		true,
	);
	const specifiers = new Set<string>();

	// Walk the AST instead of pattern-matching text, so comments and strings are ignored.
	const visit = (node: ts.Node): void => {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			specifiers.add(node.moduleSpecifier.text);
		}
		if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
			const literal = node.argument.literal;
			if (ts.isStringLiteral(literal)) specifiers.add(literal.text);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return [...specifiers];
}

// Maps a relative specifier to a vendored pkg path, probing known extensions.
async function resolveRelativeSpecifier(
	sha: string,
	currentPath: string,
	specifier: string,
): Promise<string> {
	const currentDir = path.posix.dirname(currentPath);
	const base = path.posix.normalize(path.posix.join(currentDir, specifier));

	if (!base.startsWith('pkg/lib/')) {
		throw new Error(
			`${currentPath} imports "${specifier}", which escapes pkg/lib/`,
		);
	}

	const hasKnownExtension = CANDIDATE_EXTENSIONS.some((ext) =>
		base.endsWith(ext),
	);
	const candidates = hasKnownExtension
		? [base]
		: CANDIDATE_EXTENSIONS.map((ext) => `${base}${ext}`);

	for (const candidate of candidates) {
		const text = await fetchOptionalUpstreamText(sha, candidate);
		if (text !== null) return candidate;
	}

	if ((await fetchOptionalUpstreamText(sha, `${base}.js`)) !== null) {
		throw new Error(
			`${currentPath} imports the runtime module "${specifier}"; runtime JS is never vendored`,
		);
	}

	throw new Error(
		`${currentPath} imports "${specifier}", which has no vendorable type source`,
	);
}

// Builds the closure of upstream files required by the entry declaration.
async function collectClosure(sha: string): Promise<Map<string, string>> {
	const files = new Map<string, string>();
	const queue = [UPSTREAM_ENTRY];

	while (queue.length > 0) {
		const pkgPath = queue.shift()!;
		if (files.has(pkgPath)) continue;
		if (files.size >= MAX_CLOSURE_FILES) {
			throw new Error(
				`Import closure exceeded ${MAX_CLOSURE_FILES} files; refusing to vendor an unbounded tree`,
			);
		}

		const text = await fetchUpstreamText(sha, pkgPath);
		files.set(pkgPath, text);

		for (const specifier of collectImportSpecifiers(pkgPath, text)) {
			if (NEUTERED_BARE_IMPORTS.has(specifier)) continue;
			if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
				throw new Error(
					`${pkgPath} imports the bare specifier "${specifier}"; add it to NEUTERED_BARE_IMPORTS or stop`,
				);
			}
			queue.push(await resolveRelativeSpecifier(sha, pkgPath, specifier));
		}
	}

	return files;
}

// Best-effort release anchor for the pinned commit.
async function fetchVersionAnchor(sha: string): Promise<string | null> {
	const packageJson = await fetchOptionalUpstreamText(sha, 'package.json');
	if (packageJson) {
		try {
			const parsed = JSON.parse(packageJson) as { version?: unknown };
			if (typeof parsed.version === 'string') return parsed.version;
		} catch {
			// Fall through to the spec file lookup.
		}
	}

	const spec = await fetchOptionalUpstreamText(sha, 'cockpit.spec');
	const match = spec?.match(/^Version:\s*(\S+)/m);
	if (match) return match[1];

	console.warn(
		'Could not determine the upstream release version; provenance records null',
	);
	return null;
}

// Hashes file contents for the provenance record.
function sha256(contents: string): string {
	return createHash('sha256').update(contents, 'utf8').digest('hex');
}

// Fetches the pinned snapshot and writes it, then records provenance.
async function syncMode(refOverride: string | undefined): Promise<void> {
	const requestedRef = refOverride || PINNED_REF;
	if (!requestedRef) {
		throw new Error(
			'No ref to sync from. Pass `--ref <branch|tag|sha>` or set PINNED_REF in scripts/sync-cockpit-types.ts',
		);
	}

	const sha = await resolveRef(requestedRef);
	const files = await collectClosure(sha);
	const version = await fetchVersionAnchor(sha);

	const manifest: ProvenanceManifest = {
		upstream_repo: UPSTREAM_REPO,
		upstream_ref: sha,
		upstream_version: version,
		files: {},
	};

	for (const [pkgPath, contents] of files) {
		await writeAtomic(path.join(VENDOR_DIR, pkgPath), contents);
		manifest.files[pkgPath] = sha256(contents);
	}

	await writeAtomic(
		PROVENANCE_PATH,
		`${JSON.stringify(manifest, null, '\t')}\n`,
	);

	console.log(
		`Vendored ${files.size} file(s) @ ${sha} (upstream version: ${version ?? 'unknown'})`,
	);
	console.log('Commit vendor/cockpit-types/ together with the pinned ref.');
}

// Verifies the vendored tree against its provenance record (offline).
async function checkMode(): Promise<boolean> {
	let manifest: ProvenanceManifest;
	try {
		manifest = await readJson<ProvenanceManifest>(PROVENANCE_PATH);
	} catch (error) {
		console.error(String(error));
		return false;
	}

	if (
		typeof manifest.upstream_ref !== 'string' ||
		!/^[0-9a-f]{40}$/.test(manifest.upstream_ref) ||
		typeof manifest.files !== 'object' ||
		manifest.files === null
	) {
		console.error('provenance.json is malformed');
		return false;
	}

	let ok = true;
	for (const [pkgPath, expectedHash] of Object.entries(manifest.files)) {
		let contents: string;
		try {
			contents = await readFile(path.join(VENDOR_DIR, pkgPath), 'utf8');
		} catch {
			console.error(`Missing vendored file: ${pkgPath}`);
			ok = false;
			continue;
		}
		if (sha256(contents) !== expectedHash) {
			console.error(
				`Hash mismatch for ${pkgPath}. Vendored upstream files must not be hand-edited; run \`npm run sync:cockpit-types\` to re-sync.`,
			);
			ok = false;
		}
	}

	const entry = manifest.files[UPSTREAM_ENTRY];
	if (!entry) {
		console.error(`provenance.json does not record ${UPSTREAM_ENTRY}`);
		return false;
	}

	const entryText = await readFile(
		path.join(VENDOR_DIR, UPSTREAM_ENTRY),
		'utf8',
	);
	const moduleDeclarations =
		entryText.match(/declare module 'cockpit'/g) ?? [];
	if (moduleDeclarations.length !== 1) {
		console.error(
			`${UPSTREAM_ENTRY} must contain exactly one \`declare module 'cockpit'\` (found ${moduleDeclarations.length})`,
		);
		ok = false;
	}

	if (ok) console.log('Vendored cockpit types match provenance.');
	return ok;
}

try {
	const args = process.argv.slice(2);

	if (args.includes('--check')) {
		if (!(await checkMode())) process.exitCode = 1;
	} else {
		const refIndex = args.indexOf('--ref');
		await syncMode(refIndex >= 0 ? args[refIndex + 1] : undefined);
	}
} catch (error) {
	handleError(error);
}
