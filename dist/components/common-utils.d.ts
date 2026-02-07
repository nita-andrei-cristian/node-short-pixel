/**
 * Helpers
 */
export function sleep(ms: any): Promise<any>;
export function normalizeUrl(u: any): string;
export function fetchWithTimeout(url: any, options: any, timeoutMs: any): Promise<Response>;
export function requestJsonWithRetry(url: any, options: any, { retries, retryDelay, timeout }: {
    retries: any;
    retryDelay: any;
    timeout: any;
}): Promise<any>;
export function pickFirstMeta(data: any): any;
export function pollUntilReady(makeCall: any, { interval, maxAttempts }: {
    interval: any;
    maxAttempts: any;
}): Promise<any>;
export function ensureMetaArray(data: any): any[];
export function fileFromDisk(filePath: any): Promise<any>;
export function mimeFromFilename(name: any): "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "image/avif" | "application/pdf" | "application/octet-stream";
/**
 * Web FormData + File helpers for API calls in POST-REDUCER
 * Function from other source
 */
export function getWebFormDataAndFile(): Promise<{
    FormDataCtor: any;
    FileCtor: any;
}>;
//# sourceMappingURL=common-utils.d.ts.map