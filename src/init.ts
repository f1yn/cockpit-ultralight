// This file executes commands before the full application loads. Don't import this file
// You certainly can if you want, but that's just confusing.

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
        .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
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

// Detects and applies dark mode theme based on the media selector of the parent realm (window context)
(function inheritAutoDarkMode() {
    // This script will do it's best to inherit the styles from the parent window context
    // we don't actually need the page to be fully loaded to do this
    const parentWindow = window.parent || null
    const parentDocument = (parentWindow && parentWindow.document) || null;

    if (!parentDocument || !parentWindow.matchMedia) {
        // This should be a no-op, as the parent ref is not related to the current frame's state
        // Either way, let's bail if we get here
        return;
    }

    // Cache ref to the frame's html element (not the parent)
    const htmlRoot = document.documentElement;

    function toggleDarkMode(isDarkMode: boolean) {
        if (isDarkMode) {
            htmlRoot.classList.add('pf-v5-theme-dark')
        } else {
            htmlRoot.classList.remove('pf-v5-theme-dark')
        }
    }
    // Detect dark mode on the parent, and utilize it's callback mechanism
    const match = parentWindow.matchMedia('(prefers-color-scheme: dark)');
    toggleDarkMode(match.matches);
    // Watch for changes in the system or browser state
    match.addEventListener('change', () => toggleDarkMode(match.matches));
})();

if (process.env.NODE_ENV === 'development') {
    // Code below is only injected in DEVELOPMENT (tree shaking)
    (async function autoReloader() {
        // THIS CODE IS EXPERIMENTAL - DEV ONLY
        // Because the frame document exists as a directory root, we can determine the directory we are in from
        // the window.location. For the actual path to the local link (which is the ONLY preferred development setup)
        // we rely on the cockpit connection to the host to resolve the user directory of the cockpit process. For now.
        // the current user should suffice, but we can do more commands to make this reliable later on.
        const pluginPathParts = window.location.pathname.split('/')
        const pluginName = pluginPathParts[pluginPathParts.length - 2];

        console.debug('[reloader] Sourcing cockpit userspace directory');
        // originally, this was meant to be a websocket, but this became problematic over ssh connection
        // so instead, we use the cockpit environment (which, on paper, will have access to the paths specified)
        // @ts-ignore (avoid fixing this, window.cockpit isn't something we want)
        const cockpitPluginPath = (await window.cockpit.script('echo "$HOME/.local/share/cockpit/"') || '').replace(/\n$/, '');
        console.debug(`[reloader] Attempting to hone in on app dist location (plugin ID: ${pluginName})`);
        const expectedManifestPath = `${cockpitPluginPath}${pluginName}/manifest.json`;

        try {
            expectedManifestPath
            // @ts-ignore
            await window.cockpit.script(`test -f '${expectedManifestPath}'`);
        } catch (existError) {
            // If we reach this point, there is something sus going on - let's bail out now before trying to pull a file watch 
            console.error(`[reloader] Failed to confirm that "${expectedManifestPath}" is a real path. Cancelling watch mechanism`, existError);
            return;
        }

        // The first iteration of watch is redundant for our needs
        let initialWatch = false;

        // @ts-ignore
        const watch = window.cockpit.file(expectedManifestPath).watch(() => {
            if (!initialWatch) {
                console.debug('[reloader] Watch has been established')
                initialWatch = true;
                return;
            }

            console.debug('[reloader] Manifest update has been detected, refreshing in approx 1 second!')

            // Reload when the manifest updates (give a little extra time as well)
            setTimeout(() => window.location.reload(), 1000);

            // Be good citizens - let's try and remove the watch before a refresh
            window.addEventListener('beforeunload', () => {
                watch.remove();
            })
        });
    })();
}