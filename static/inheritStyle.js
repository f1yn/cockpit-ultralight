// Cockpit reality inheritance - Flynn Buckingham - 2024
// The iframe content and the window exist within the same realm, which means the parent can access the child and the child
// iframe can access the parent frame (the user's window). Because of this, instead of complicating the build step, we can simply
// duplicate the styles from the parent window and inject them into this frame (if we so desire).
(function inheritStyle() {
	// This script will do it's best to inherit the styles from the parent window context
	// we don't actually need the page to be fully loaded to do this
	const parentDocument = (window.parent && window.parent.document) || null;

	if (!parentDocument) {
		// This should be a no-op, as the parent ref is not related to the current frame's state
		// Either way, let's bail if we get here
		return;
	}

	// We'll append all the parent styles in one go
	const stylesFragment = document.createDocumentFragment();

	parentDocument
		// pull the parent stylesheets (in order)
		.querySelectorAll('link[rel="stylesheet"]')
		.forEach((parentLinkNode) => {
			// Event relative link tags, their href is treated as an URL (instance) which resolves based on it's context.
			// No matter what level this iframe is in, we should be getting the absolute path back here
			// create the new link tag in this realm, then add it to the fragment
			const newTarget = document.createElement('link');
			newTarget.href = `${parentLinkNode.href}`;
			newTarget.rel = 'stylesheet';
			newTarget.type = 'text/css';
			stylesFragment.appendChild(newTarget);
		});

	// Append the style tags in one go
	document.head.appendChild(stylesFragment);
})();
