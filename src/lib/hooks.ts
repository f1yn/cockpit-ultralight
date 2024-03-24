import React, { useState, useMemo, useEffect } from 'react';
import cockpit, { Cockpit } from 'cockpit';

type fileWatchArguments = Parameters<typeof cockpit.file>;

/**
 * Watches a file on the host system, updates it's result when changes are made.
 * Developer: Please memoize fileWatchOptions if provided, otherwise the watch will treat options as new inputs and remount the hook
 * @param path The filesystem path to watch
 * @param fileWatchOptions Options for the file handler
 * @returns The contexts of the file, along with any potential exceptions
 */
export function useFileWatch<resultType = string>(path: fileWatchArguments[0], fileWatchOptions?: fileWatchArguments[1]) {
    type fileWatchCallbackResult = Parameters<Cockpit.FileWatchCallback<resultType>>;
    const [result, setResult] = useState<fileWatchCallbackResult>();

    useEffect(() => {
        const watch =
            fileWatchOptions ?
                cockpit.file(path, fileWatchOptions).watch((...result) => setResult(result as fileWatchCallbackResult)) :
                cockpit.file(path).watch((...result) => setResult(result as fileWatchCallbackResult));
        return () => watch.remove();
    }, [path, fileWatchOptions])

    return result || [];
}

/**
 * Executes a series of bash commands (or script) and returns it's result.
 * Developer: Please memoize args/spawnOptions if provided, otherwise the watch will treat options as new inputs and remount the hook
 * @param command The command or bash script code to execute
 * @param args Additional arguments to the provided command
 * @param spawnOptions Additional spawn commands
 * @returns 
 */
export function useCommandResult<resultType = string>(command: string, args?: string[], spawnOptions?: Cockpit.SpawnOptions) {
    const [result, setResult] = useState<resultType | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [exceptionString, setExceptionString] = useState<Cockpit.ProcessException | null>(null);

    useEffect(() => {
        cockpit.script<resultType>(command, args, spawnOptions)
            .then((result, message) => {
                setResult(result);
                setMessage(message || null);
                setExceptionString(null);
            })
            .catch((errorMessage, otherResult) => {
                setExceptionString(errorMessage);
                setMessage(null);
                setResult(null);
            });
    }, [command, args, spawnOptions])

    return [result, exceptionString, message] as const;
}