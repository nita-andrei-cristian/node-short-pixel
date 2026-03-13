export interface ShortPixelExpressOptions {
    apiKey?: string;
    passthrough?: boolean;
    extraWhitelist?: string[];
    blacklist?: string[];
    overrideWhitelist?: string[];
    [key: string]: any;
}
export interface ShortPixelExpressFile {
    buffer?: any;
    data?: any;
    originalname?: string;
    name?: string;
    filename?: string;
    path?: string;
    tempFilePath?: string;
    size?: number;
    [key: string]: any;
}
export interface ShortPixelExpressSource {
    kind: "file" | "url" | "path";
    field: string | null;
    index: number | null;
    value: any;
    name: string | null;
    path: string | null;
}
export interface ShortPixelExpressOutput {
    filename: string | null;
    path: string | null;
    size: number | null;
}
export interface ShortPixelExpressResult {
    kind: "file" | "url" | "path";
    input: any;
    field: string | null;
    index: number | null;
    source: ShortPixelExpressSource;
    output: ShortPixelExpressOutput;
    buffer: any;
    meta: any;
    filename: string;
    path?: string;
}
export interface ShortPixelExpressState {
    files: ShortPixelExpressResult[];
    urls: ShortPixelExpressResult[];
    paths: ShortPixelExpressResult[];
}
export interface ShortPixelExpressRequest {
    file?: ShortPixelExpressFile;
    files?: ShortPixelExpressFile[] | Record<string, ShortPixelExpressFile | ShortPixelExpressFile[] | undefined>;
    body?: Record<string, any>;
    shortPixel?: ShortPixelExpressState;
    [key: string]: any;
}
export type ShortPixelExpressNext = (error?: any) => void;
export function ShortPixelExpress(options?: ShortPixelExpressOptions): (req: ShortPixelExpressRequest, res: any, next: ShortPixelExpressNext) => Promise<void>;
