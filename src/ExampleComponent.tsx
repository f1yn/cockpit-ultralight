import React from 'react';
import cockpit from 'cockpit';

import {
	Button,
	Card,
	CardTitle,
	CardBody,
	CardFooter,
	Grid,
	GridItem,
} from '@patternfly/react-core';

export default function ExampleComponent() {
	return (
		<Card>
			<Grid>
				<GridItem
					md={4}
					style={{
						minHeight: '200px',
						backgroundPosition: 'center',
						backgroundRepeat: 'no-repeat',
						backgroundSize: 'contain',
						backgroundImage: 'url(./cockpit-ultralight-icon.svg)',
					}}
				/>
				<GridItem md={8}>
					<CardTitle>Cockpit Ultralight Plugin</CardTitle>
					<CardBody>Welcome to your first cockpit plugin!</CardBody>
					<CardFooter>
						<Button variant="tertiary">Call to action</Button>
					</CardFooter>
				</GridItem>
			</Grid>
		</Card>
	);
}
