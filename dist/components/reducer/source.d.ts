/**
 * The Source class (Inspired by tinify style)
 */
export class Source {
    constructor({ url, urls, buffer, filename, files }?: {
        url?: any;
        urls?: any;
        buffer?: any;
        filename?: any;
        files?: any;
    });
    url: any;
    urls: any[];
    buffer: any;
    filename: any;
    options: {};
    files: any[];
    lastMetas: any[];
    lastResults: {
        meta: any;
        input: {
            urls: any[];
            url: any;
            displayName: any;
        };
    }[] | {
        meta: any;
        input: {
            index: number;
            buffer: any;
            path: any;
            displayName: any;
            fileKey: string;
        };
    }[] | {
        meta: any;
        input: {
            index: number;
            buffer: any;
            path: any;
            displayName: any;
            fileKey: string;
        };
    }[];
    _getEffectiveOptions(): {};
    setOptions(opts?: {}): this;
    reducer(): Promise<any[]>;
    /**
     * PostReducer (upload local files or buffers)
     * Supports batching via src.files = [{ filename }, { buffer, filename }]
     *
     * Remember, this is the API specific for files and buffer in general. Reducer is only for URL.
     *
     * The process is a bit more complex here than the reducer API.
     */
    postReducer(): Promise<any[]>;
    /**
     * Download the optimized files from the latest reducer/postReducer call into outputDir.
     * Returns an array of { path, meta }.
     *
     * You should know that at the end of each API call (reducer / post-reducer),
     * we save the lastMetas and lastResults, the point is to use them here.
     */
    downloadTo(outputDir: any, { timeout }?: {
        timeout?: any;
    }): Promise<{
        path: any;
        meta: any;
    }[]>;
}
/**
 * HELPERS
 *
 * Behavior:
 *
 * Based on a paramter (1) and options (2) -> Returns a SOURCE.
 * You may download items directly via SOURCE->downloadTo(path)
 *
 * (1) - paramaters varies by helper name, either url, local file, or a buffer. (or many urls, local files and buffers if you want to batch process them)
 * (2) - Options that customize the behaviour of the processing, this includes upscaling, chaning background, cropping, resizing, optimization aggresivness, etc. See them at [https://shortpixel.com/api-docs]
 *
 * For advanced users, you may utilize the source to inspect per file optimization latency by creating your custom poll. See the 'downloadTo' function to take inspiration :)
 *
 */
export function fromUrl(url: any, options: any): Promise<Source>;
export function fromBuffer(buffer: any, filename: string, options: any): Promise<Source>;
export function fromFile(filePath: any, options: any): Promise<Source>;
export function fromUrls(urls: any[], options: any): Promise<Source>;
export function fromURLs(urls: any[], options: any): Promise<Source>;
export function fromBuffers(buffers: any[], defaultName: string, options: any): Promise<Source>;
export function fromFiles(filePaths: any[], options: any): Promise<Source>;
//# sourceMappingURL=source.d.ts.map