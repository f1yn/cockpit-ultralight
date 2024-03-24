import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Bullseye, Spinner, Grid, GridItem } from '@patternfly/react-core';

import ExampleComponent from './ExampleComponent';
const ExampleDynamicImport = React.lazy(() => import('./ExampleDynamicImport'));

function App() {
	return (
		<Suspense
			fallback={
				// shows a spinner when dynamically imported content is being rendered (including the initial render)
				<Bullseye>
					<Spinner />
				</Bullseye>
			}
		>
			<Grid lg={6} md={12}>
				<GridItem>
					<ExampleComponent />
				</GridItem>
				<GridItem>
					<ExampleDynamicImport />
				</GridItem>
			</Grid>
		</Suspense>
	);
}

createRoot(document.getElementById('app')!).render(<App />);
