import { useState, useEffect } from 'react';
import cockpit from 'cockpit';
import type { FileOpenOptions, FileWatchCallback, SpawnOptions } from 'cockpit';

/**
 * Watches a file on the host system, updates it's result when changes are made.
 * Developer: Please memoize fileWatchOptions if provided, otherwise the hook will treat options as new inputs and remount the hook
 * @param path The filesystem path to watch
 * @param fileWatchOptions Options for the file handler
 * @returns The contexts of the file, along with any potential exceptions
 */
export function useFileWatch<resultType = string>(
	path: string,
	fileWatchOptions?: FileOpenOptions,
) {
	type fileWatchCallbackResult = Parameters<FileWatchCallback<resultType>>;
	const [result, setResult] = useState<fileWatchCallbackResult>();

	useEffect(() => {
		const watch = fileWatchOptions
			? cockpit
					.file(path, fileWatchOptions)
					.watch((...result) =>
						setResult(result as fileWatchCallbackResult),
					)
			: cockpit
					.file(path)
					.watch((...result) =>
						setResult(result as fileWatchCallbackResult),
					);
		return () => watch.remove();
	}, [path, fileWatchOptions]);

	return result || [];
}

/**
 * Executes a series of bash commands (or script) and returns it's result.
 * Developer: Please memoize args/spawnOptions if provided, otherwise the hook will treat options as new inputs and remount the hook
 * @param command The command or bash script code to execute
 * @param args Additional arguments to the provided command
 * @param spawnOptions Additional spawn commands
 * @returns
 */
export function useCommandResult<resultType = string>(
	command: string,
	args?: string[],
	spawnOptions?: SpawnOptions & { binary?: false },
) {
	const [result, setResult] = useState<resultType | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [exceptionString, setExceptionString] = useState<Error | null>(null);

	useEffect(() => {
		cockpit
			.script(command, args ?? [], spawnOptions)
			.done((data, message) => {
				setResult(data as resultType);
				setMessage(message || null);
				setExceptionString(null);
			})
			.fail((errorMessage) => {
				setExceptionString(errorMessage);
				setMessage(null);
				setResult(null);
			});
	}, [command, args, spawnOptions]);

	return [result, exceptionString, message] as const;
}
