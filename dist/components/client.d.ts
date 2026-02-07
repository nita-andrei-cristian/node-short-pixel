export default Client;
declare class Client {
    constructor({ apiKey, pluginVersion, proxy }?: {
        apiKey?: string;
        pluginVersion?: string;
        proxy?: any;
    });
    set(name: any, value: any): void;
    fromUrl(url: any, options: any): Promise<Source>;
    fromUrls(urls: any, options: any): Promise<Source>;
    fromURLs(urls: any, options: any): Promise<Source>;
    fromBuffer(buffer: any, filename: any, options: any): Promise<Source>;
    fromBuffers(buffers: any, defaultName: any, options: any): Promise<Source>;
    fromFile(path: any, options: any): Promise<Source>;
    fromFiles(paths: any, options: any): Promise<Source>;
    /**
     * User-friendly aliases for default optimization helpers.
     */
    optimizeUrl(url: any, options: any): Promise<Source>;
    optimizeUrls(urls: any, options: any): Promise<Source>;
    optimizeBuffer(buffer: any, filename: any, options: any): Promise<Source>;
    optimizeBuffers(buffers: any, defaultName: any, options: any): Promise<Source>;
    optimizeFile(path: any, options: any): Promise<Source>;
    optimizeFiles(paths: any, options: any): Promise<Source>;
    _splitOptimizeOptions(options?: {}): {
        filename: any;
        defaultName: any;
        apiOptions: {};
    };
    _optimizeMany(inputs: any, { filename, defaultName, apiOptions }: {
        filename: any;
        defaultName: any;
        apiOptions: any;
    }): Promise<Source>;
    _optimizeObject(input: any, { filename, defaultName, apiOptions }: {
        filename: any;
        defaultName: any;
        apiOptions: any;
    }): Promise<Source>;
    /**
     * Generic optimization dispatcher:
     * - URL string/object -> reducer
     * - file path/object  -> post-reducer
     * - buffer/object     -> post-reducer
     * - arrays route to the corresponding batch helper
     */
    optimize(input: any, options?: {}): Promise<Source>;
    _withFeature(input: any, featureOptions: any, options?: {}): Promise<Source>;
    lossless(input: any, options?: {}): Promise<Source>;
    lossy(input: any, options?: {}): Promise<Source>;
    glossy(input: any, options?: {}): Promise<Source>;
    wait(input: any, seconds: any, options?: {}): Promise<Source>;
    upscale(input: any, factor?: number, options?: {}): Promise<Source>;
    rescale(input: any, width: any, height: any, options?: {}): Promise<Source>;
    resizeOuter(input: any, width: any, height: any, options?: {}): Promise<Source>;
    resizeInner(input: any, width: any, height: any, options?: {}): Promise<Source>;
    smartCrop(input: any, width: any, height: any, options?: {}): Promise<Source>;
    convert(input: any, convertto: any, options?: {}): Promise<Source>;
    cmykToRgb(input: any, enabled?: boolean, options?: {}): Promise<Source>;
    keepExif(input: any, enabled?: boolean, options?: {}): Promise<Source>;
    backgroundChange(input: any, background?: number, options?: {}): Promise<Source>;
    backgroundRemove(input: any, options?: {}): Promise<Source>;
    refresh(input: any, enabled?: boolean, options?: {}): Promise<Source>;
    /**
     * Expose Source (advanced usage)
     */
    Source(): typeof Source;
}
import { Source } from "./reducer.js";
//# sourceMappingURL=client.d.ts.map