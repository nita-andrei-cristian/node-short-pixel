/*
 * source.js
 *
 * HERE LIES THE CORE FUNCTIONALITY OF THE MODULE
 *
 * The SOURCE class is defined here, the source is responsible for:
 * - Calling the Shortpixel API
 * - Handling network system
 * - Handling errors
 * - Downloading the images locally
 * - Exposing an optimized image URL
 *
 * If you're an advanced user, you may customize the Source class to allign with your goals. Such as inspecting performance per file and other options.
 *
 *
 * We are working with metas quite a lot, so if you're confused, here is a key idea:
 * - Meta is more like a snapshot that represents if a certain image is processed or not. If it is, also a URL.
 * Do not confuse meta with the file itself, it's only a message that tells us what's going on with the file.
 *
 * According to the docs, meta contains this:
 *
 * meta['LossyURL']
 * meta['Status']['Code']
 *
 * */

import fs from "fs";
import path from "path";

/*
 * SELF-EXPLANATORY UTILS
 * */

import {
  ShortPixelError,
  ShortPixelAuthError,
  ShortPixelQuotaError,
  ShortPixelTemporaryError,
  ShortPixelInvalidRequestError,
  ShortPixelBatchError,
} from "../error-utils";

import {
  validateOptions,
  validateConfig,
  ensureUrlList,
  readJsonSafe,
  validatePollConfig
} from "../validate-utils";

import {
  classifyBySpCode,
  buildErrorFromSp,
  getSpCode,
} from "../spcode-utils";

import {
  sleep,
  normalizeUrl,
  fetchWithTimeout,
  requestJsonWithRetry,
  ensureMetaArray,
  fileFromDisk,
  mimeFromFilename,
  getWebFormDataAndFile,

} from "../common-utils";
import { pickBestOutputUrl } from "./pick-best-output-url";

import { config } from "../config";
import { REDUCER_URL, POST_REDUCER_URL } from "./constants";

/**
 * The Source class (Inspired by tinify style)
 */
class Source {
  constructor({ url = null, urls = null, buffer = null, filename = null, files = null } = {}) {
    this.url = url;
    this.urls = Array.isArray(urls) ? urls : null;
    this.buffer = buffer;
    this.filename = filename; // local path if fromFile()
    this.options = {};
    this.files = Array.isArray(files) ? files : null; // optional batching: [{ filename }, { buffer, filename }]

    // Keep last optimization results to enable subsequent downloads
    // Without these you can't download them
    this.lastMetas = null;
    this.lastResults = null;
  }

  _getEffectiveOptions() {
  // apply the default config conversion or per-call conversion
    const defaultConvert =
      typeof config.convertto === "string" && config.convertto.trim() ? config.convertto : null;

    if (this.options?.convertto == null && defaultConvert) {
      return { ...this.options, convertto: defaultConvert };
    }
    return this.options;
  }

  setOptions(opts = {}) {
    // See "https://shortpixel.com/api-docs" for more info.
    // YOU CAN PASS via OPTS ANY KIND OF API-SUPPORTED parameter
    this.options = { ...this.options, ...opts };
    return this;
  }

  async reducer() {
    /*
     * THIS IMPLEMENTS THE REDUCER API THAT IS RESPONSIBLE FOR OPTIMIZING URLS
     *
     * */

    // sanitize checks
    validateConfig();
    validatePollConfig(config.poll);

    const effectiveOptions = this._getEffectiveOptions();
    const { urllist: _ignoredUrlList, ...optsWithoutUrlList } = effectiveOptions || {};

    // ensures input urls are existing and normalizes the list
    // without this erros may occur when reading url
    const inputUrls = Array.isArray(this.urls) && this.urls.length
      ? this.urls
      : (this.url ? [this.url] : []);

    if (!inputUrls.length) {
      throw new ShortPixelInvalidRequestError("Reducer requires at least one URL source.", { spCode: -105 });
    }

    const normalizedList = inputUrls.map((u, idx) => {
      const normalized = normalizeUrl(u);
      if (!normalized) {
        throw new ShortPixelInvalidRequestError("Invalid URL for reducer.", { spCode: -102, payload: u, index: idx });
      }
      return encodeURI(normalized);
    });

    // sanitize the options
    validateOptions(effectiveOptions);

    // parse urlname
    const deriveUrlName = (u) => {
      try {
        const parsed = new URL(u);
        return path.basename(parsed.pathname || "") || null;
      } catch {
        return null;
      }
    };

    // function to make the request json with retry
    const makeCall = async (urlsPayload) => {
      const payload = {
        key: config.key,
        plugin_version: config.plugin_version,
        wait: effectiveOptions.wait != null ? effectiveOptions.wait : config.wait,
        urllist: urlsPayload,
        ...optsWithoutUrlList
      };

      // sanitize urls
      ensureUrlList(payload.urllist);

      const data = await requestJsonWithRetry(
        REDUCER_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload)
        },
        { retries: config.retries, retryDelay: config.retryDelay, timeout: config.timeout }
      );

      return ensureMetaArray(data);
    };

    const metas = await makeCall(normalizedList);

    // if any of the received metas is missing we error
    if (metas.length !== normalizedList.length) {
      throw new ShortPixelError("Response length does not match requested URLs count.", {
        payload: { sent: normalizedList.length, got: metas.length, metas }
      });
    }

    // tie response items back to input order
    // This is usefull to know what name each file should have when downloading
    //
    // We'll also use this in just a moment to check which have been loaded
    const perItem = normalizedList.map((u, idx) => {
      const meta = metas[idx];
      const code = getSpCode(meta);
      const entry = {
        index: idx,
        input: { urls: inputUrls, url: inputUrls[idx], normalizedUrl: u, displayName: deriveUrlName(inputUrls[idx]) },
        meta
      };

      if (code !== 1 && code !== 2) entry.error = buildErrorFromSp(meta);
      return entry;
    });

    const failed = perItem.filter((x) => x.error);
    if (failed.length) {
      throw new ShortPixelBatchError("One or more URLs failed during reducer call.", { items: perItem });
    }

    // Poll pending URLs (Code 1) if enabled
    if (config.poll?.enabled) {
      let attempts = 0;
      // loop while there are pending items AND attempts budget remains
      while (attempts < config.poll.maxAttempts) {
        const pendingItems = perItem.filter((x) => getSpCode(x.meta) === 1);
        if (pendingItems.length === 0) break; // work is done, all are processed (no more codes 1)

        // pending items get converted into urls
        const payloadUrls = pendingItems.map((x) => x.input.normalizedUrl);
        const metas2 = await makeCall(payloadUrls);

        // We check again how many pending metas 
        if (metas2.length !== pendingItems.length) {
          throw new ShortPixelError("Response length does not match pending URLs count.", {
            payload: { sent: pendingItems.length, got: metas2.length, metas: metas2 }
          });
        }

        // updates the new metas
        for (let i = 0; i < metas2.length; i++) {
          const meta = metas2[i];
          const code = getSpCode(meta);
          if (code !== 1 && code !== 2) throw buildErrorFromSp(meta);
          pendingItems[i].meta = meta; // mutate the same reference stored in perItem
        }

        const stillPending = perItem.some((x) => getSpCode(x.meta) === 1);
        if (!stillPending) break;

        await sleep(config.poll.interval);
        attempts++;
      }

      // If you see this error, you may try to inrease poll MaxAttempts
      const stillPendingFinal = perItem.filter((x) => getSpCode(x.meta) === 1);
      if (stillPendingFinal.length) {
        throw new ShortPixelTemporaryError("Some URLs are still pending after polling.", {
          spCode: 1,
          payload: stillPendingFinal.map((x) => x.meta)
        });
      }
    }


    const ordered = perItem.slice().sort((a, b) => a.index - b.index);
    const finalMetas = ordered.map((x) => x.meta);

    // Track last results for optional download step
    this.lastMetas = finalMetas;
    this.lastResults = ordered.map((x) => ({
      meta: x.meta,
      input: { urls: inputUrls, url: x.input.url, displayName: x.input.displayName }
    }));

    return finalMetas;
  }

  /**
   * PostReducer (upload local files or buffers)
   * Supports batching via src.files = [{ filename }, { buffer, filename }]
   */
  async postReducer() {
    validateConfig();
    const effectiveOptions = this._getEffectiveOptions();

    validateOptions(effectiveOptions);
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
      form.append("wait", String(effectiveOptions.wait != null ? effectiveOptions.wait : 30));

      // API options (stringify all)
      for (const [k, v] of Object.entries(effectiveOptions)) {
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
      const sorted = perItem.sort((a, b) => a.index - b.index);
      const metas = sorted.map((x) => x.meta);

      // Persist results for later download
      this.lastMetas = metas;
      this.lastResults = sorted.map((x) => ({ meta: x.meta, input: x.input }));

      return metas;
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
        ...effectiveOptions
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

    const metas = perItem.sort((a, b) => a.index - b.index).map((x) => x.meta);

    // Persist results for later download
    this.lastMetas = metas;
    this.lastResults = perItem
      .sort((a, b) => a.index - b.index)
      .map((x) => ({ meta: x.meta, input: x.input }));

    return metas;
  }

  /**
   * Download the optimized files from the latest reducer/postReducer call into outputDir.
   * Returns an array of { path, meta }.
   */
  async downloadTo(outputDir, { timeout = config.timeout } = {}) {
    if (!outputDir || typeof outputDir !== "string" || !outputDir.trim()) {
      throw new ShortPixelInvalidRequestError("downloadTo requires a target directory path.", {
        spCode: -109,
        payload: outputDir
      });
    }

    if (!Array.isArray(this.lastMetas) || !this.lastMetas.length) {
      throw new ShortPixelInvalidRequestError(
        "No optimization results found. Call reducer/postReducer first.",
        { spCode: -109 }
      );
    }

    await fs.promises.mkdir(outputDir, { recursive: true });

    const downloads = [];
    const effectiveOptions = this._getEffectiveOptions();

    const pickExtension = (bestUrlExt, converttoExt, sourceExt) => {
      if (converttoExt) return converttoExt;
      if (bestUrlExt) return bestUrlExt;
      if (sourceExt) return sourceExt;
      return "bin";
    };

    const converttoToExt = (converttoRaw) => {
      const c = typeof converttoRaw === "string" ? converttoRaw.toLowerCase() : "";
      if (!c) return null;
      if (c.includes("avif")) return "avif";
      if (c.includes("webp")) return "webp";
      if (c.includes("png")) return "png";
      if (c.includes("jpeg")) return "jpeg";
      if (c.includes("jpg")) return "jpg";
      return null;
    };

    for (let i = 0; i < this.lastMetas.length; i++) {
      const meta = this.lastMetas[i];
      const bestUrl = pickBestOutputUrl(meta, effectiveOptions);

      if (!bestUrl) {
        throw new ShortPixelError("No downloadable URL returned by ShortPixel for item.", { payload: meta });
      }

      const res = await fetchWithTimeout(bestUrl, { redirect: "follow" }, timeout);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new ShortPixelError("Failed to download optimized file.", {
          httpStatus: res.status,
          payload: body,
          url: bestUrl
        });
      }

      const buf = Buffer.from(await res.arrayBuffer());
      const urlPath = new URL(bestUrl).pathname || "";
      const nameFromUrl = path.basename(urlPath) || null;

      const inputInfo = this.lastResults?.[i]?.input ?? null;
      const sourceNameRaw =
        (inputInfo?.displayName && path.basename(inputInfo.displayName)) ||
        (inputInfo?.path && path.basename(inputInfo.path)) ||
        (inputInfo?.filename && path.basename(inputInfo.filename)) ||
        (inputInfo?.url && (() => {
          try {
            return path.basename(new URL(inputInfo.url).pathname || "");
          } catch {
            return null;
          }
        })()) ||
        (meta?.OriginalURL && (() => {
          try {
            return path.basename(new URL(meta.OriginalURL).pathname || "");
          } catch {
            return null;
          }
        })()) ||
        null;

      const parsedSource = sourceNameRaw ? path.parse(sourceNameRaw) : null;
      const sourceBase = parsedSource?.name || `optimized_${i + 1}`;
      const sourceExt = parsedSource?.ext ? parsedSource.ext.replace(/^\./, "").toLowerCase() : null;
      const bestUrlExt = path.extname(nameFromUrl || "").replace(/^\./, "").toLowerCase() || null;
      const converttoExt = converttoToExt(effectiveOptions.convertto);

      const finalExt = pickExtension(bestUrlExt, converttoExt, sourceExt);
      const outName = `${sourceBase}.${finalExt}`;
      const outPath = path.join(outputDir, outName);

      await fs.promises.writeFile(outPath, buf);

      downloads.push({ path: outPath, meta });
    }

    return downloads;
  }
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

// takes a single url
async function fromUrl(url, options) {
  const src = new Source({ url });
  if (options) src.setOptions(options);
  await src.reducer();
  return src;
}

// takes a single buffer
async function fromBuffer(buffer, filename = "image.bin", options) {
  const src = new Source({ buffer, filename });
  if (options) src.setOptions(options);
  await src.postReducer();
  return src;
}

// takes a single file path
async function fromFile(filePath, options) {
  const src = new Source({ filename: filePath });
  if (options) src.setOptions(options);
  await src.postReducer();
  return src;
}

// takes an array of urls 
async function fromUrls(urls = [], options) {
  const list = Array.isArray(urls) ? urls : [urls];
  const src = new Source({ urls: list });
  if (options) src.setOptions(options);
  await src.reducer();
  return src;
}
const fromURLs = fromUrls;

// Takes the list of images which can be:
// 1. Array of buffers [buffer1, buffer2, ...]
// 2. Array of objects [{buffer : [BUFFER1]}, {buffer : [BUFFER2]}, ...]
async function fromBuffers(buffers = [], defaultName = "image.bin", options) {
  const list = Array.isArray(buffers) ? buffers : [buffers];
  const files = list.map((entry, idx) => {
    if (entry && typeof entry === "object" && "buffer" in entry) {
      const filename = entry.filename || entry.name || `upload_${idx + 1}.bin`;
      return { buffer: entry.buffer, filename };
    }
    const filename = list.length > 1 ? `upload_${idx + 1}.bin` : defaultName;
    return { buffer: entry, filename };
  });
  const src = new Source({ files });
  if (options) src.setOptions(options);
  await src.postReducer();
  return src;
}

// Takes the list of images which can be:
// 1. Array of paths ["path1", "path2", ...]
// 2. Array of objects [{filename : "path1"}, {filename : "path2"}, ...]
async function fromFiles(filePaths = [], options) {
  const list = Array.isArray(filePaths) ? filePaths : [filePaths];

  const files = list.map((entry, idx) => {
    // Already in expected shape
    if (entry && typeof entry === "object") {
      if ("filename" in entry || "buffer" in entry) return entry;
    }

    // Accept plain string paths
    if (typeof entry === "string" && entry.trim()) return { filename: entry };

    throw new ShortPixelInvalidRequestError(
      "fromFiles expects string paths or objects containing {filename} / {buffer}.",
      { spCode: -109, payload: entry, index: idx }
    );
  });

  const src = new Source({ files });
  if (options) src.setOptions(options);
  await src.postReducer();
  return src;
}

export {
  Source,
  fromUrl,
  fromBuffer,
  fromFile,
  fromUrls,
  fromURLs,
  fromBuffers,
  fromFiles
};
