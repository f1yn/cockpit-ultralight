import React from 'react';
import cockpit from 'cockpit';
import {
	Alert,
	Card,
	CardTitle,
	CardBody,
	CodeBlock,
} from '@patternfly/react-core';

import { useFileWatch, useCommandResult } from '@lib/hooks';

// A component that's loaded in dynamically is really good for things with heavy dependencies
// that don't need to exist on every screen
export default function ExampleDynamicImport() {
	const [hostname] = useFileWatch<string>('/etc/hostname');
	const [hostnameResult, error] = useCommandResult<string>('hostnamectl');

	return (
		<>
			<Card>
				<CardTitle>Example Lazy-loaded content</CardTitle>
				<CardBody>
					<Alert
						variant="info"
						title={cockpit.format(
							'This view is dynamically loaded only when it is shown on screen',
						)}
					/>
				</CardBody>
			</Card>
			<Card>
				<CardTitle>
					Current hostname (live from /etc/hostname)
				</CardTitle>
				<CardBody>
					{hostname && <CodeBlock>{hostname}</CodeBlock>}
				</CardBody>
			</Card>
			<Card>
				<CardTitle>hostnamectl result (from command)</CardTitle>
				<CardBody>
					{hostnameResult && (
						<CodeBlock
							style={{
								fontFamily: 'monospace',
								whiteSpace: 'break-spaces',
							}}
						>
							{hostnameResult}
						</CodeBlock>
					)}
				</CardBody>
			</Card>
		</>
	);
}
