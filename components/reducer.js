 /*
 * 
 * THIS CODE IS NOT FINISHED! PLEASE WAIT ANOTHER 24h since this commit when I will update this code
 * But untill then, here is a basic overview.
 *
 * The whole idea behind this implementation is that it calls the ShortPixel API and tries to handle
 * errors or pending via preconfigured params. It supports batching which makes the debugging and error 
 * handling very messy, again this should be cleaned up in 24h
 *
 * THIS IS THE SOURCE FOR NODE SHORT PIXEL API
 * Please keep the documentation close as you read throughout this code.
 * https://shortpixel.com/api-docs
 *
 * This file is yet to be split into multiple components
 *
 * KEY CONCEPTS
 * 1. REDUCER -> optimizes urls
 * 2. POST-REDUCER API -> optimizes local files / buffers
 *
 * The Source class is extremly important as it manages a particular batch of images yet to be optimized
 * The Source class is inspired from tinify API.
 *
 * ---------------------- CONFIGURING
 * The optimization process may be configured in the Source Class below. (Via 'setOptions').
 * THIS ARE THE OPTIONS
 *
 * (( 1 ))
 * lossy : {
 *	0 -> Lossless (max quality)
 *	1 -> Lossy (default) (balance of size and quality)
 *	2 -> Glossy (high quality)
 * }
 *
 * (( 2 ))
 * resize : {
 *	0 | 1 | 3 | 4
 * }
 * 0 -> no resize
 * 1 -> outer resize (image counts resize_width, resize_hegith rect)
 * 3 -> inner resize (image will be contained in the width, height)
 * 4 -> smart crop (AI)
 *
 * if resize > 0, then resize_width and height must be > 0
 *
 * (( 3 ))
 * upscale : {
 *	0 | 2 | 3 | 4
 * }
 * 0 -> disabled
 * 2/3/4 -> AI upscale
 *
 * (( 4 ))
 * wait: 0..30
 * how much time waits before API responds
 * 0 -> responds instantly -> (most likely you get Status=1)
 * I recommend not changing this
 *
 * (( 5 ))
 * convertto : string
 {
 "+webp"
 "+avif"
 "+webp|+avif"
 "webp"
 "avif"
 "jpg"
 "png"
 } 
 * I recommend not changing this one because it is automatically picking best output url
 *
 * (( 6 ))

Other options supported by shortpixel API

cmyk2rgb
keep_exif
refresh
bg_remove 

See reducer API is shortpixel docs for explinations here.

 *
 * ----------------------
 *
 * Both support optimizing multiple files at one (batching) or just one.
 * So far this has been tested on both png and jpg files.
 *
 * This heavily relies on status codes for error handling, you can find them
 * in the documentation docs or below.
 *
        1 - No errors, image scheduled for processing.
        2 - No errors, image processed, download URL available.
        -102 - Invalid URL. Please make sure the URL is properly urlencoded and points to a valid image file.
        -103 - Invalid website URL. Please make sure the URL is valid and points to an accessible website.
        -104 - ID is missing for the call or is invalid.
        -105 - URL is missing for the call.
        -106 - URL is inaccessible from our server(s) due to access restrictions.
        -107 - Too many URLs in a POST, maximum allowed has been exceeded.
        -108 - Invalid user used for optimizing images from a particular domain.
        -109 - Please use reducer.php endpoint for URL optimizations.
        -110 - Upload error.
        -111 - File too big.
        -112 - Generic server error.
        -113 - Too many inaccessible URLs from the same domain, please check accessibility and try again.
        -114 - Please provide the local file paths of the optimized images.
        -115 - Uploaded files are missing.
        -116 - The number of URL parameters needs to be equal with the number of URLs.
        -117 - Please pass the file_paths parameter as per the API specs.
        -201 - Invalid image format.
        -202 - Invalid image or unsupported image format.
        -203 - Could not download file.
        -204 - The file couldn't be optimized, possibly timedout.
        -205 - The file's width and/or height is too big.
        -206 - The PDF file is password protected and it cannot be optimized.
        -207 - Invalid parameters for background removal.
        -301 - The file is larger than the remaining quota.
        -302 - The file is no longer available.
        -303 - Internal API error: the file was not written on disk.
        -304 - Internal API Error: could not create the user upload space.
        -305 - Internal API error: Unknown, details usually in message.
        -306 - Files need to be from a single domain per request.
        -401 - Invalid API key. Please check that the API key is the one provided to you.
        -402 - Wrong API Key.
        -403 - Quota exceeded. You need to subscribe to a larger plan or to buy an additional one time package to increase your quota.
        -404 - The maximum number of URLs in the optimization queue reached. Please try again in a minute.
        -500 - API is in maintenance mode. Please come back later.

* We use some custom error classes for these codes for more organized debugging (especially upstream)


 * */ 


import fs from "fs";
import path from "path";

// The TWO URLs of ShortPixel (REDUCER AND POST-REDUCER API)
const REDUCER_URL = "https://api.shortpixel.com/v2/reducer.php";
const POST_REDUCER_URL = "https://api.shortpixel.com/v2/post-reducer.php";

// GLOBAL CONFIGURATION
let config = {
  key: "",
  plugin_version: "NP001", // max 5 chars, alphanumeric
  timeout: 30000, // ms
  retries: 2,
  retryDelay: 800, // ms base delay (exponential backoff)
  wait: 20, // reducer wait default
  poll: { 
    enabled: true, 
    interval: 1500, // ms
    maxAttempts: 12
  }
};

/**
 * Custom Error Classes
 */
class ShortPixelError extends Error {
  constructor(
    message,
    { httpStatus = null, spCode = null, spMessage = null, payload = null, cause = null } = {}
  ) {
    super(message);
    this.name = "ShortPixelError";
    this.httpStatus = httpStatus;
    this.spCode = spCode;
    this.spMessage = spMessage;
    this.payload = payload;
    this.cause = cause;
  }
}
class ShortPixelAuthError extends ShortPixelError {
  constructor(message, meta = {}) {
    super(message, meta);
    this.name = "ShortPixelAuthError";
  }
}
class ShortPixelQuotaError extends ShortPixelError {
  constructor(message, meta = {}) {
    super(message, meta);
    this.name = "ShortPixelQuotaError";
  }
}
class ShortPixelTemporaryError extends ShortPixelError {
  constructor(message, meta = {}) {
    super(message, meta);
    this.name = "ShortPixelTemporaryError";
  }
}
class ShortPixelInvalidRequestError extends ShortPixelError {
  constructor(message, meta = {}) {
    super(message, meta);
    this.name = "ShortPixelInvalidRequestError";
  }
}
class ShortPixelBatchError extends ShortPixelError {
  constructor(message, { items = [], ...meta } = {}) {
    super(message, meta);
    this.name = "ShortPixelBatchError";
    this.items = items; // [{ index, input, meta?, error? }]
  }
}

/**
 * Helpers
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function validateConfig() {
  if (!config.key || typeof config.key !== "string" || !config.key.trim()) {
    throw new ShortPixelAuthError("Missing ShortPixel API key (config.key).", { spCode: -401 });
  }
  if (!config.plugin_version || typeof config.plugin_version !== "string") {
    throw new ShortPixelInvalidRequestError("Invalid config.plugin_version.", { spCode: -104 });
  }
  if (config.plugin_version.length > 5) {
    throw new ShortPixelInvalidRequestError("config.plugin_version must be max 5 characters.", {
      spCode: -104
    });
  }
}

function ensureUrlList(urls) {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new ShortPixelInvalidRequestError("urllist must be a non-empty array.", { spCode: -105 });
  }
  if (urls.length > 100) {
    throw new ShortPixelInvalidRequestError("Too many URLs in a single request (max 100).", {
      spCode: -107
    });
  }
}

function normalizeUrl(u) {
  if (typeof u !== "string" || !u.trim()) return null;
  try {
    const url = new URL(u);
    return url.toString();
  } catch {
    return null;
  }
}

function validateOptions(opts = {}) {
  // resize sanity
  if (opts.resize && Number(opts.resize) > 0) {
    const w = opts.resize_width != null ? Number(opts.resize_width) : null;
    const h = opts.resize_height != null ? Number(opts.resize_height) : null;
    if ((!w || w <= 0) && (!h || h <= 0)) {
      throw new ShortPixelInvalidRequestError(
        "resize is set but resize_width/resize_height are missing or invalid.",
        { spCode: -116 }
      );
    }
  }

  // upscale sanity
  if (opts.upscale != null) {
    const up = Number(opts.upscale);
    if (![0, 2, 3, 4].includes(up)) {
      throw new ShortPixelInvalidRequestError("upscale must be 0, 2, 3, or 4.", { spCode: -116 });
    }
  }

  // wait sanity
  if (opts.wait != null) {
    const w = Number(opts.wait);
    if (Number.isNaN(w) || w < 0 || w > 30) {
      throw new ShortPixelInvalidRequestError("wait must be between 0 and 30.", { spCode: -116 });
    }
  }
}

function classifyBySpCode(code) {
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

function buildErrorFromSp(meta, httpStatus = 200) {
  const spCode = Number(meta?.Status?.Code);
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

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    throw new ShortPixelTemporaryError("Network/timeout error while calling ShortPixel.", { cause: err });
  } finally {
    clearTimeout(id);
  }
}

async function readJsonSafe(res) {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new ShortPixelError("Non-JSON or invalid JSON response from ShortPixel.", {
      httpStatus: res.status,
      payload: { contentType, text },
      cause: e
    });
  }
}

async function requestJsonWithRetry(url, options, { retries, retryDelay, timeout }) {
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

function pickFirstMeta(data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new ShortPixelError("Unexpected response: expected a non-empty array.", { payload: data });
  }
  return data[0];
}

async function pollUntilReady(makeCall, { interval, maxAttempts }) {
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

function ensureMetaArray(data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new ShortPixelError("Unexpected response: expected a non-empty array.", { payload: data });
  }
  return data;
}

function getSpCode(meta) {
  return Number(meta?.Status?.Code);
}

function validatePollConfig(poll) {
  if (!poll?.enabled) return;
  if (!Number.isInteger(poll.maxAttempts) || poll.maxAttempts <= 0) {
    throw new ShortPixelInvalidRequestError("poll.maxAttempts must be a positive integer.");
  }
  if (!Number.isInteger(poll.interval) || poll.interval < 0) {
    throw new ShortPixelInvalidRequestError("poll.interval must be a non-negative integer (ms).");
  }
}

/**
 * Web FormData + File helpers (works with Node fetch / undici).
 * This is the key fix vs `form-data` + `form.getHeaders()`.
 */
async function getWebFormDataAndFile() {
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

function mimeFromFilename(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".avif") return "image/avif";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

async function fileFromDisk(filePath) {
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

function pickBestOutputUrl(meta, opts = {}) {
  // If user requested conversion, try AVIF/WebP first, but fall back to PNG/JPG always.
  const convertto = typeof opts.convertto === "string" ? opts.convertto : "";
  const lossy = Number(opts.lossy ?? 1);

  const wantsAvif = convertto.includes("avif");
  const wantsWebp = convertto.includes("webp");

  const pick = (lossyUrl, losslessUrl) => {
    if (lossy > 0 && lossyUrl && lossyUrl !== "NA") return lossyUrl;
    if (losslessUrl && losslessUrl !== "NA") return losslessUrl;
    return null;
  };

  if (wantsAvif) {
    const url = pick(meta.AVIFLossyURL, meta.AVIFLosslessURL);
    if (url) return url;
  }
  if (wantsWebp) {
    const url = pick(meta.WebPLossyURL, meta.WebPLosslessURL);
    if (url) return url;
  }

  // Default: keep original format optimized
  return pick(meta.LossyURL, meta.LosslessURL);
}

/**
 * The Source class (Inspired by tinify style)
 */
class Source {
  constructor({ url = null, buffer = null, filename = null } = {}) {
    this.url = url;
    this.buffer = buffer;
    this.filename = filename; // local path if fromFile()
    this.options = {};
    this.files = null; // optional batching: [{ filename }, { buffer, filename }]
  }

  setOptions(opts = {}) {
    this.options = { ...this.options, ...opts };
    return this;
  }

  async reducer() {
    validateConfig();

    if (!this.url) {
      throw new ShortPixelInvalidRequestError("Reducer requires a URL source.", { spCode: -105 });
    }

    const normalized = normalizeUrl(this.url);
    if (!normalized) {
      throw new ShortPixelInvalidRequestError("Invalid URL for reducer.", { spCode: -102, payload: this.url });
    }

    validateOptions(this.options);

    const payload = {
      key: config.key,
      plugin_version: config.plugin_version,
      wait: this.options.wait != null ? this.options.wait : config.wait,
      urllist: [encodeURI(normalized)],
      ...this.options
    };

    ensureUrlList(payload.urllist);

    const makeCall = async () => {
      const data = await requestJsonWithRetry(
        REDUCER_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload)
        },
        { retries: config.retries, retryDelay: config.retryDelay, timeout: config.timeout }
      );

      const meta = pickFirstMeta(data);
      const code = Number(meta?.Status?.Code);

      if (code === 1 || code === 2) return meta;
      throw buildErrorFromSp(meta);
    };

    const first = await makeCall();
    const code = Number(first?.Status?.Code);

    if (code === 1 && config.poll?.enabled) {
      return pollUntilReady(makeCall, config.poll);
    }

    return first;
  }

  /**
   * PostReducer (upload local files or buffers)
   * Supports batching via src.files = [{ filename }, { buffer, filename }]
   */
  async postReducer() {
    validateConfig();
    validateOptions(this.options);
    validatePollConfig(config.poll);

    const files = Array.isArray(this.files) && this.files.length
      ? this.files
      : [{ buffer: this.buffer ?? null, filename: this.filename ?? null }];

    if (!files.length) {
      throw new ShortPixelInvalidRequestError("PostReducer requires at least one file.", { spCode: -109 });
    }

    // Normalize items
    const items = files.map((f, idx) => {
      const hasBuffer = !!f?.buffer;
      const hasFilename = !!f?.filename;

      if (!hasBuffer && !hasFilename) {
        throw new ShortPixelInvalidRequestError(`File #${idx + 1} requires either {buffer} or {filename}.`, {
          spCode: -109,
          payload: f
        });
      }

      const displayName =
        typeof f.filename === "string" && f.filename.trim()
          ? f.filename.trim()
          : `upload_${idx + 1}.bin`;

      if (!hasBuffer) {
        if (!fs.existsSync(displayName)) {
          throw new ShortPixelInvalidRequestError("Local file does not exist for postReducer.", {
            spCode: -115,
            payload: displayName
          });
        }
      }

      return {
        index: idx,
        buffer: hasBuffer ? f.buffer : null,
        path: hasBuffer ? null : displayName,
        displayName,
        fileKey: `file${idx + 1}`
      };
    });

    // Upload call (multipart) using Web FormData
    const makeUploadCall = async () => {
      const { FormDataCtor, FileCtor } = await getWebFormDataAndFile();
      const form = new FormDataCtor();

      // Required fields
      form.append("key", config.key);
      form.append("plugin_version", config.plugin_version);
      form.append("wait", String(this.options.wait != null ? this.options.wait : 30));

      // API options (stringify all)
      for (const [k, v] of Object.entries(this.options)) {
        if (v === undefined || v === null) continue;
        // Avoid accidentally sending urllist in post-reducer
        if (k === "urllist") continue;
        form.append(k, typeof v === "string" ? v : String(v));
      }

      // file_paths mapping
      const filePathsMap = {};
      for (const it of items) filePathsMap[it.fileKey] = path.basename(it.displayName);
      form.append("file_paths", JSON.stringify(filePathsMap));

      // Attach files
      for (const it of items) {
        if (it.buffer) {
          const type = mimeFromFilename(it.displayName);
          const fileObj = new FileCtor([it.buffer], path.basename(it.displayName), { type });
          form.append(it.fileKey, fileObj, fileObj.name);
        } else {
          const fileObj = await fileFromDisk(it.path);
          form.append(it.fileKey, fileObj, fileObj.name);
        }
      }

      // IMPORTANT: do NOT manually set multipart headers; fetch will do it correctly
      // (this is what fixes the nginx 400)
      const data = await requestJsonWithRetry(
        POST_REDUCER_URL,
        {
          method: "POST",
          headers: { Accept: "application/json" },
          body: form
        },
        { retries: config.retries, retryDelay: config.retryDelay, timeout: config.timeout }
      );

      return ensureMetaArray(data);
    };

    // 1) Upload once
    const uploadMetas = await makeUploadCall();

    if (uploadMetas.length !== items.length) {
      throw new ShortPixelError("Response length does not match uploaded files count.", {
        payload: { sent: items.length, got: uploadMetas.length, uploadMetas }
      });
    }

    // 2) Evaluate statuses
    const perItem = items.map((it, i) => {
      const meta = uploadMetas[i];
      const code = getSpCode(meta);

      if (code === 1 || code === 2) return { index: it.index, input: it, meta };

      const err = buildErrorFromSp(meta);
      return { index: it.index, input: it, error: err, meta };
    });

    const failed = perItem.filter((x) => x.error);
    if (failed.length) {
      throw new ShortPixelBatchError("One or more files failed during post-reducer upload.", { items: perItem });
    }

    // 3) If no polling or nothing pending => return
    const pendingNow = perItem.filter((x) => getSpCode(x.meta) === 1);
    if (!config.poll?.enabled || pendingNow.length === 0) {
      return perItem.sort((a, b) => a.index - b.index).map((x) => x.meta);
    }

    // 4) Poll reducer.php for pending OriginalURLs (NO re-upload)
    const originalUrlToIndex = new Map();
    for (const x of pendingNow) {
      const ou = x.meta?.OriginalURL;
      if (!ou || typeof ou !== "string") {
        throw new ShortPixelTemporaryError("Pending item returned without OriginalURL for follow-up.", {
          spCode: 1,
          payload: x.meta
        });
      }
      originalUrlToIndex.set(ou, x.index);
    }

    let attempts = 0;
    while (attempts < config.poll.maxAttempts) {
      const currentPendingOriginals = perItem
        .filter((x) => x.meta && getSpCode(x.meta) === 1)
        .map((x) => x.meta.OriginalURL)
        .filter(Boolean);

      if (currentPendingOriginals.length === 0) break;

      const payload2 = {
        key: config.key,
        plugin_version: config.plugin_version,
        wait: config.wait,
        urllist: currentPendingOriginals.map((u) => encodeURI(u)),
        ...this.options
      };
      ensureUrlList(payload2.urllist);

      const data2 = await requestJsonWithRetry(
        REDUCER_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload2)
        },
        { retries: config.retries, retryDelay: config.retryDelay, timeout: config.timeout }
      );

      const metas2 = ensureMetaArray(data2);

      for (const meta of metas2) {
        const code = getSpCode(meta);
        if (code !== 1 && code !== 2) throw buildErrorFromSp(meta);

        const ou = meta?.OriginalURL;
        if (!ou || typeof ou !== "string") continue;

        const idx = originalUrlToIndex.get(ou);
        if (idx == null) continue;

        const entry = perItem.find((x) => x.index === idx);
        if (entry) entry.meta = meta;
      }

      const stillPending = perItem.some((x) => x.meta && getSpCode(x.meta) === 1);
      if (!stillPending) break;

      await sleep(config.poll.interval);
      attempts++;
    }

    const stillPendingFinal = perItem.filter((x) => x.meta && getSpCode(x.meta) === 1);
    if (stillPendingFinal.length) {
      throw new ShortPixelTemporaryError("Some files are still pending after polling.", {
        spCode: 1,
        payload: stillPendingFinal.map((x) => x.meta)
      });
    }

    return perItem.sort((a, b) => a.index - b.index).map((x) => x.meta);
  }
}

/**
 * Factory helpers
 */
function fromUrl(url) {
  return new Source({ url });
}
function fromBuffer(buffer, filename = "image.bin") {
  return new Source({ buffer, filename });
}
function fromFile(filePath) {
  return new Source({ filename: filePath });
}

export {
  Source,
  fromUrl,
  fromBuffer,
  fromFile,
  config as _config,

  // errors
  ShortPixelError,
  ShortPixelAuthError,
  ShortPixelQuotaError,
  ShortPixelTemporaryError,
  ShortPixelInvalidRequestError,
  ShortPixelBatchError,

  // helpers (optional export)
  pickBestOutputUrl
};

