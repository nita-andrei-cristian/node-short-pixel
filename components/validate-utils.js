import { config } from "./config";
import {
  ShortPixelError,
  ShortPixelAuthError,
  ShortPixelInvalidRequestError
} from "./error-utils";

export function validateConfig() {
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

export function ensureUrlList(urls) {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new ShortPixelInvalidRequestError("urllist must be a non-empty array.", { spCode: -105 });
  }
  if (urls.length > 100) {
    throw new ShortPixelInvalidRequestError("Too many URLs in a single request (max 100).", {
      spCode: -107
    });
  }
}

export function validateOptions(opts = {}) {
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

export async function readJsonSafe(res) {
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

export function validatePollConfig(poll) {
  if (!poll?.enabled) return;
  if (!Number.isInteger(poll.maxAttempts) || poll.maxAttempts <= 0) {
    throw new ShortPixelInvalidRequestError("poll.maxAttempts must be a positive integer.");
  }
  if (!Number.isInteger(poll.interval) || poll.interval < 0) {
    throw new ShortPixelInvalidRequestError("poll.interval must be a non-negative integer (ms).");
  }
}

