// originally based on https://github.com/cockpit-project/cockpit-files/blob/main/src/cockpit.d.ts
// original license: https://github.com/cockpit-project/cockpit-files/blob/main/LICENSE

// THIS IS A PROXY. TRY NOT TO EDIT THIS FILE.
// IF YOU FIND YOU'RE FORCED TO, PLEASE OPEN AN ISSUE AT
// https://github.com/f1yn/cockpit-ultralight/issues


// TODO: We need commends for each of the exposed module functions (if we can)

export declare module Cockpit {
    type JsonValue =
        | null
        | boolean
        | number
        | string
        | JsonValue[]
        | { [key: string]: JsonValue };
    type JsonObject = Record<string, JsonValue>;

    type ProblemCodes = 'access-denied' | 'authentication-failed' | 'internal-error' | 'no-cockpit' |
        'no-session' | 'not-found' | 'terminated' | 'timeout' | 'unknown-hostkey' | 'no-forwarding';

    class BasicError {
        problem: ProblemCodes;
        message: string;
        toString(): string;
    }

    /* === Events mix-in ========================= */

    interface EventMap {
        [_: string]: (...args: any[]) => void;
    }

    type EventListener<E extends (...args: unknown[]) => void> = (
        event: CustomEvent<Parameters<E>>,
        ...args: Parameters<E>
    ) => void;

    interface EventSource<EM extends EventMap> {
        addEventListener<E extends keyof EM>(
            event: E,
            listener: EventListener<EM[E]>,
        ): void;
        removeEventListener<E extends keyof EM>(
            event: E,
            listener: EventListener<EM[E]>,
        ): void;
        dispatchEvent<E extends keyof EM>(
            event: E,
            ...args: Parameters<EM[E]>
        ): void;
    }

    interface CockpitEvents extends EventMap {
        locationchanged(): void;
        visibilitychange(): void;
    }

    function addEventListener<E extends keyof CockpitEvents>(
        event: E,
        listener: EventListener<CockpitEvents[E]>,
    ): void;
    function removeEventListener<E extends keyof CockpitEvents>(
        event: E,
        listener: EventListener<CockpitEvents[E]>,
    ): void;

    interface ChangedEvents {
        changed(): void;
    }

    /* === Channel =============================== */

    interface ControlMessage extends JsonObject {
        command: string;
    }

    interface ChannelEvents<T> extends EventMap {
        control(options: JsonObject): void;
        ready(options: JsonObject): void;
        close(options: JsonObject): void;
        message(data: T): void;
    }

    interface Channel<T> extends EventSource<ChannelEvents<T>> {
        id: string | null;
        binary: boolean;
        options: JsonObject;
        valid: boolean;
        send(data: T): void;
        control(options: ControlMessage): void;
        wait(): Promise<void>;
        close(options?: JsonObject): void;
    }

    interface ChannelOptions {
        payload: string;
        superuser?: string;
        [_: string]: JsonValue | undefined;
    }

    function channel(
        options: ChannelOptions & { binary?: false },
    ): Channel<string>;
    function channel(
        options: ChannelOptions & { binary: true },
    ): Channel<Uint8Array>;

    /* === cockpit.location ========================== */

    interface Location {
        url_root: string;
        options: { [name: string]: string | Array<string> };
        path: Array<string>;
        href: string;
        go(path: Location | string, options?: { [key: string]: string }): void;
        replace(
            path: Location | string,
            options?: { [key: string]: string },
        ): void;
    }

    export const location: Location;

    /* === cockpit.dbus ========================== */

    interface DBusProxyEvents extends EventMap {
        changed(changes: { [property: string]: unknown }): void;
    }

    interface DBusProxy extends EventSource<DBusProxyEvents> {
        valid: boolean;
        [property: string]: unknown;
    }

    interface DBusOptions {
        bus?: string;
        address?: string;
        superuser?: 'require' | 'try';
        track?: boolean;
    }

    interface DBusClient {
        readonly unique_name: string;
        readonly options: DBusOptions;
        proxy(
            interface: string,
            path: string,
            options?: { watch?: boolean },
        ): DBusProxy;
        close(): void;
    }

    function dbus(name: string | null, options?: DBusOptions): DBusClient;

    /* === cockpit.file ========================== */

    interface FileSyntaxObject<T, B> {
        parse(content: B): T;
        stringify(content: T): B;
    }

    type FileTag = string;

    export type FileWatchCallback<T> = (
        data: T | null,
        tag: FileTag | null,
        error: BasicError | null,
    ) => void;
    interface FileWatchHandle {
        remove(): void;
    }

    interface FileHandle<T> {
        read(): Promise<T>;
        replace(content: T): Promise<FileTag>;
        watch(
            callback: FileWatchCallback<T>,
            options?: { read?: boolean },
        ): FileWatchHandle;
        modify(callback: (data: T) => T): Promise<[T, FileTag]>;
        close(): void;
        path: string;
    }

    type FileOpenOptions = {
        max_read_size?: number;
        superuser?: string;
    };

    function file(
        path: string,
        options?: FileOpenOptions & { binary?: false; syntax?: undefined },
    ): FileHandle<string>;
    function file(
        path: string,
        options: FileOpenOptions & { binary: true; syntax?: undefined },
    ): FileHandle<Uint8Array>;
    function file<T>(
        path: string,
        options: FileOpenOptions & {
            binary?: false;
            syntax: FileSyntaxObject<T, string>;
        },
    ): FileHandle<T>;
    function file<T>(
        path: string,
        options: FileOpenOptions & {
            binary: true;
            syntax: FileSyntaxObject<T, Uint8Array>;
        },
    ): FileHandle<T>;

    /* === cockpit.user ========================== */

    type UserInfo = {
        id: number;
        name: string;
        full_name: string;
        groups: Array<string>;
        home: string;
        shell: string;
    };

    export function user(): Promise<UserInfo>;

    /* === cockpit.spawn
    ========================== */

    // ensure that environ string contain equals somewhere in the middle
    type EnvironStringEntity = `${string}=${string}`;

    export type SpawnOptions = {
        binary?: true;
        directory?: string;
        err?: 'out' | 'ignore' | 'message' | 'pty';
        environ?: EnvironStringEntity[];
        pty?: string;
        batch?: number;
        latency?: number;
        superuser?: 'require' | 'try';
    };

    export type ProcessException = {
        message: string;
        problem: ProblemCodes | null;
        exit_status: number | null;
        exit_signal: number | null;
    };

    /**
     * The result of a script or spawn call to cockpit (resembles a promise)
     * https://cockpit-project.org/guide/latest/cockpit-spawn.html
     */
    interface SpawnedProcess<processDatatype = string> {
        then: (onfulfilled: (data: processDatatype, message?: string) => void) => this;
        catch: (onrejected: (exception: ProcessException, optimisticCommandOutput?: processDatatype) => void) => this;
        stream: (streamCallback: (data: processDatatype) => void) => void;
        input: (data: processDatatype, stream?: boolean) => void;
        close: (problemCode?: ProblemCodes) => void;
    }

    export function spawn<processDatatype = string>(args: [], spawnOptions?: SpawnOptions): SpawnedProcess<processDatatype>;

    /* === cockpit.script ========================== */
    export function script<processDatatype = string>(script: string, args?: string[], scriptOptions?: SpawnOptions): SpawnedProcess<processDatatype>;

    /* === String helpers ======================== */

    function gettext(message: string): string;
    function gettext(context: string, message?: string): string;
    function ngettext(message1: string, messageN: string, n: number): string;
    function ngettext(
        context: string,
        message1: string,
        messageN: string,
        n: number,
    ): string;

    function format_bytes(n: number): string;
    function format(format_string: string, ...args: unknown[]): string;

    // TODO: Add other types here
}

// Instead of running around, and adding global types just for improper usage, skip checking what window.cockpit
// is, instead applying the type directly to the export (as if it were the window module)
// @ts-ignore
const cockpitWindowRef = window.cockpit;

export default cockpitWindowRef as typeof Cockpit;
