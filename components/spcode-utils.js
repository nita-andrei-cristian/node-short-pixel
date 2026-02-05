import {
  ShortPixelError,
  ShortPixelAuthError,
  ShortPixelQuotaError,
  ShortPixelInvalidRequestError,
  ShortPixelTemporaryError
} from "./error-utils";

export function classifyBySpCode(code) {
  if (code === -401 || code === -402) return { type: "auth", retry: false };
  if (code === -403 || code === -301) return { type: "quota", retry: false };

  // retryable server-ish codes
  if (code === -404 || code === -500 || code === -112 || code === -305 || code === -204)
    return { type: "temporary", retry: true };

  // invalid request / input
  if (
    [
      -102, -103, -104, -105, -106, -107, -108, -109, -110, -111, -113, -114, -115, -116, -117,
      -201, -202, -203, -205, -206, -207, -302, -303, -304, -306
    ].includes(code)
  )
    return { type: "invalid", retry: false };

  if (code < 0) return { type: "temporary", retry: true };
  return { type: "ok", retry: false };
}

export function getSpCode(meta) {
  return Number(meta?.Status?.Code);
}

export function buildErrorFromSp(meta, httpStatus = 200) {
  const spCode = getSpCode(meta);
  const spMessage = meta?.Status?.Message ?? "Unknown ShortPixel error";
  const base = { httpStatus, spCode, spMessage, payload: meta };

  const cls = classifyBySpCode(spCode);
  if (cls.type === "auth") return new ShortPixelAuthError(`ShortPixel auth error: ${spMessage}`, base);
  if (cls.type === "quota") return new ShortPixelQuotaError(`ShortPixel quota error: ${spMessage}`, base);
  if (cls.type === "invalid")
    return new ShortPixelInvalidRequestError(`ShortPixel invalid request: ${spMessage}`, base);
  if (cls.type === "temporary")
    return new ShortPixelTemporaryError(`ShortPixel temporary error: ${spMessage}`, base);

  return new ShortPixelError(`ShortPixel error: ${spMessage}`, base);
}
