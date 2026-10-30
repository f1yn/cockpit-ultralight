// Owned type facade: re-exports every named member of the augmented `cockpit`
// module WITHOUT its `default` export. `export *` deliberately excludes `default`,
// which is what lets src/lib/cockpit-globals.d.ts describe the runtime API object
// without a circular reference back to the bridge module's default export.

export * from 'cockpit';
