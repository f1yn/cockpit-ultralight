// Types `window.cockpit` for both module imports and the classic script in src/init.ts.
// The facade (`cockpit-api`) re-exports the vendored augmentation's named members
// without the bridge's `default`, which keeps this type from being circular.

import type * as CockpitApi from 'cockpit-api';

declare global {
	interface Window {
		cockpit: typeof CockpitApi;
	}
}

export {};
