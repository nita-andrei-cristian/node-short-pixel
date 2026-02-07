import fs from "fs";
import path from "path";
import {
  ShortPixelError,
  ShortPixelTemporaryError,
  ShortPixelInvalidRequestError
} from "./error-utils.js";
import { buildErrorFromSp } from "./spcode-utils.js";
import { readJsonSafe, ensureHttpsUrl, normalizeProxyUrl } from "./validate-utils.js";
import { config } from "./config.js";

let cachedProxyUrl = null;
let cachedProxyDispatcher = null;

/**
 * Helpers
 */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function normalizeUrl(u) {
  if (typeof u !== "string" || !u.trim()) return null;
  try {
    const url = new URL(u.trim());
    return url.toString();
  } catch {
    return null;
  }
}

function getEnvProxy() {
  if (!process?.env) return null;
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    null
  );
}

async function resolveProxyDispatcher() {
  const configuredProxy = normalizeProxyUrl(config.proxy);
  const envProxy = normalizeProxyUrl(getEnvProxy());
  const proxyUrl = configuredProxy || envProxy;

  if (!proxyUrl) return null;

  if (cachedProxyUrl === proxyUrl && cachedProxyDispatcher) {
    return cachedProxyDispatcher;
  }

  let undici;
  try {
    undici = await import("undici");
  } catch (err) {
    throw new ShortPixelInvalidRequestError(
      "Proxy is configured but undici is unavailable for proxy support.",
      { spCode: -104, payload: proxyUrl, cause: err }
    );
  }

  if (typeof undici.ProxyAgent !== "function") {
    throw new ShortPixelInvalidRequestError("ProxyAgent is not available in undici.", {
      spCode: -104,
      payload: proxyUrl
    });
  }

  if (cachedProxyDispatcher && typeof cachedProxyDispatcher.close === "function") {
    try {
      await cachedProxyDispatcher.close();
    } catch {
      // ignore close errors when replacing dispatcher
    }
  }

  cachedProxyDispatcher = new undici.ProxyAgent(proxyUrl);
  cachedProxyUrl = proxyUrl;

  return cachedProxyDispatcher;
}

export async function fetchWithTimeout(url, options, timeoutMs) {
  const safeUrl = ensureHttpsUrl(url, { fieldName: "Request URL", spCode: -102 });
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchOptions = { ...options, signal: controller.signal };
    const dispatcher = await resolveProxyDispatcher();

    if (dispatcher && fetchOptions.dispatcher == null) {
      fetchOptions.dispatcher = dispatcher;
    }

    return await fetch(safeUrl, fetchOptions);
  } catch (err) {
    if (err instanceof ShortPixelInvalidRequestError) throw err;
    throw new ShortPixelTemporaryError("Network/timeout error while calling ShortPixel.", { cause: err });
  } finally {
    clearTimeout(id);
  }
}

export async function requestJsonWithRetry(url, options, { retries, retryDelay, timeout }) {
  let attempt = 0;
  let lastErr = null;

  while (attempt <= retries) {
    try {
      const res = await fetchWithTimeout(url, options, timeout);

      if (!res.ok) {
        const body = await res.text().catch(() => "");

        // Retry on 429 or 5xx
        if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
          throw new ShortPixelTemporaryError(`HTTP ${res.status} from ShortPixel.`, {
            httpStatus: res.status,
            payload: body
          });
        }

        throw new ShortPixelError(`HTTP error from ShortPixel: ${res.status}`, {
          httpStatus: res.status,
          payload: body
        });
      }

      return await readJsonSafe(res);
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof ShortPixelTemporaryError;

      if (!retryable || attempt === retries) break;

      const backoff = retryDelay * Math.pow(2, attempt);
      await sleep(backoff);
      attempt++;
    }
  }

  throw lastErr || new ShortPixelError("Unknown error calling ShortPixel.");
}

export function pickFirstMeta(data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new ShortPixelError("Unexpected response: expected a non-empty array.", { payload: data });
  }
  return data[0];
}

// Polls repeatdly untill a unfinished file is found
export async function pollUntilReady(makeCall, { interval, maxAttempts }) {
  let last = null;

  for (let i = 0; i < maxAttempts; i++) {
    last = await makeCall();
    const code = Number(last?.Status?.Code);

    if (code === 2) return last;
    if (code !== 1) throw buildErrorFromSp(last);

    await sleep(interval);
  }

  const spCode = Number(last?.Status?.Code ?? 1);
  const spMessage = last?.Status?.Message ?? "Image still pending.";
  throw new ShortPixelTemporaryError("Optimization is still pending after polling.", {
    spCode,
    spMessage,
    payload: last
  });
}

export function ensureMetaArray(data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new ShortPixelError("Unexpected response: expected a non-empty array.", { payload: data });
  }
  return data;
}

export async function fileFromDisk(filePath) {
  const { FormDataCtor, FileCtor } = await getWebFormDataAndFile();

  // Use undici fileFromPath if available (no full buffering)
  try {
    const undici = await import("undici");
    if (typeof undici.fileFromPath === "function") {
      const type = mimeFromFilename(filePath);
      return await undici.fileFromPath(filePath, { type });
    }
  } catch {
    // ignore, fall back to buffer
  }

  // Fallback: buffer into memory
  const buf = await fs.promises.readFile(filePath);
  const name = path.basename(filePath);
  const type = mimeFromFilename(name);
  return new FileCtor([buf], name, { type });
}


export function mimeFromFilename(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".avif") return "image/avif";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

/**
 * Web FormData + File helpers for API calls in POST-REDUCER
 * Function from other source
 */
export async function getWebFormDataAndFile() {
  // Prefer globals (Node 20+)
  if (globalThis.FormData && globalThis.File) {
    return { FormDataCtor: globalThis.FormData, FileCtor: globalThis.File };
  }

  // Fallback to undici exports if globals not present
  try {
    const undici = await import("undici");
    return { FormDataCtor: undici.FormData, FileCtor: undici.File };
  } catch {
    throw new ShortPixelError(
      "FormData/File are not available. Use Node 18+ or install 'undici'."
    );
  }
}
