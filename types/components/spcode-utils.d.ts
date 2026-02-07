export function classifyBySpCode(code: any): {
    type: string;
    retry: boolean;
};
export function getSpCode(meta: any): number;
export function buildErrorFromSp(meta: any, httpStatus?: number): ShortPixelError;
import { ShortPixelError } from "./error-utils";
