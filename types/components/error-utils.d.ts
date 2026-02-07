/**
 * Custom Error Classes
 */
export class ShortPixelError extends Error {
    constructor(message: any, { httpStatus, spCode, spMessage, payload, cause }?: {
        httpStatus?: any;
        spCode?: any;
        spMessage?: any;
        payload?: any;
        cause?: any;
    });
    httpStatus: any;
    spCode: any;
    spMessage: any;
    payload: any;
    cause: any;
}
export class ShortPixelAuthError extends ShortPixelError {
    constructor(message: any, meta?: {});
}
export class ShortPixelQuotaError extends ShortPixelError {
    constructor(message: any, meta?: {});
}
export class ShortPixelTemporaryError extends ShortPixelError {
    constructor(message: any, meta?: {});
}
export class ShortPixelInvalidRequestError extends ShortPixelError {
    constructor(message: any, meta?: {});
}
export class ShortPixelBatchError extends ShortPixelError {
    constructor(message: any, { items, ...meta }?: {
        items?: any[];
    });
    items: any[];
}
