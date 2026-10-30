/**
 * Runtime bridge to the Cockpit host API.
 *
 * The host page loads `../base1/cockpit.js`, which defines `window.cockpit` in the
 * same realm as this frame; this module re-exports that instance. ALL Cockpit API
 * types come from the vendored upstream snapshot under `vendor/cockpit-types`
 * (its `declare module 'cockpit'` augmentation merges into this module). Never
 * re-declare Cockpit API types here.
 * @remarks `Window.cockpit` is declared in src/lib/cockpit-globals.d.ts. Provenance
 * and the drift gate live in scripts/sync-cockpit-types.ts.
 */

export default window.cockpit;
