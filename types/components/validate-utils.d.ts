export function normalizeProxyUrl(proxy: any): string;
export function ensureHttpsUrl(url: any, { fieldName, spCode }?: {
    fieldName?: string | undefined;
    spCode?: number | undefined;
    upgradeHttp?: boolean | undefined;
}): string;
export function validateConfig(): void;
export function ensureUrlList(urls: any): void;
export function validateOptions(opts?: {}): void;
export function readJsonSafe(res: any): Promise<any>;
export function validatePollConfig(poll: any): void;
