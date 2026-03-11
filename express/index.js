/*

See the official npm documentation or check the entry point at the bottom of the page.

*/

import fs from "fs";
import path from "path";
import ShortPixelClient from "../components/client.js";

const DEFAULT_URL_FIELDS = ["url", "urls", "imageUrl", "imageUrls"];
const DEFAULT_PATH_FIELDS = ["filepath", "filepaths", "filePath", "filePaths", "imagePath", "imagePaths"];
const DEFAULT_FILE_FIELDS = ["file", "files", "image", "images", "upload", "uploads"];
const DEFAULT_WHITELIST = [...DEFAULT_URL_FIELDS, ...DEFAULT_PATH_FIELDS, ...DEFAULT_FILE_FIELDS];
const MIN_OPTIMIZE_FILE_SIZE = 50_000;

function normalizeFiles(req) {
  const files = [];

  if (req?.file) {
    files.push({
      field: getFileFieldName(req.file, "file"),
      index: null,
      file: req.file
    });
  }

  if (Array.isArray(req?.files)) {
    for (let index = 0; index < req.files.length; index++) {
      const file = req.files[index];
      files.push({
        field: getFileFieldName(file, "files"),
        index,
        file
      });
    }
  } else if (req?.files && typeof req.files === "object") {
    for (const [key, value] of Object.entries(req.files)) {
      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
          const file = value[index];
          files.push({
            field: getFileFieldName(file, key),
            index,
            file
          });
        }
      } else if (value) {
        files.push({
          field: getFileFieldName(value, key),
          index: null,
          file: value
        });
      }
    }
  }

  return files;
}

function normalizeBodyStrings(req, fields) {
  const values = [];

  for (const field of fields) {
    const value = req?.body?.[field];

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        const entry = value[index];
        if (typeof entry === "string" && entry.trim()) {
          values.push({
            field,
            index,
            value: entry.trim()
          });
        }
      }
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      values.push({
        field,
        index: null,
        value: value.trim()
      });
    }
  }

  return values;
}

function mergeFieldNames(...lists) {
  const merged = [];
  const seen = new Set();

  for (const list of lists) {
    if (!Array.isArray(list)) {
      continue;
    }

    for (const entry of list) {
      if (typeof entry !== "string" || !entry.trim()) {
        continue;
      }

      const field = entry.trim();
      if (!seen.has(field)) {
        seen.add(field);
        merged.push(field);
      }
    }
  }

  return merged;
}

function excludeFieldNames(fields, blacklist) {
  if (!Array.isArray(blacklist) || !blacklist.length) {
    return fields;
  }

  const blocked = new Set(
    blacklist
      .filter((entry) => typeof entry === "string" && entry.trim())
      .map((entry) => entry.trim())
  );

  return fields.filter((field) => !blocked.has(field));
}

function isHttpUrlString(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function splitBodyEntries(entries) {
  const urls = [];
  const paths = [];

  for (const entry of entries) {
    if (isHttpUrlString(entry.value)) {
      urls.push(entry);
      continue;
    }

    paths.push(entry);
  }

  return { urls, paths };
}

function getResultState(req) {
  if (!req.shortPixel || typeof req.shortPixel !== "object") {
    req.shortPixel = {};
  }

  if (!Array.isArray(req.shortPixel.files)) {
    req.shortPixel.files = [];
  }

  if (!Array.isArray(req.shortPixel.urls)) {
    req.shortPixel.urls = [];
  }

  if (!Array.isArray(req.shortPixel.paths)) {
    req.shortPixel.paths = [];
  }

  return req.shortPixel;
}

function getFileFieldName(file, fallback = "file") {
  if (typeof file?.fieldname === "string" && file.fieldname.trim()) {
    return file.fieldname.trim();
  }

  if (typeof file?.field === "string" && file.field.trim()) {
    return file.field.trim();
  }

  if (typeof fallback === "string" && fallback.trim()) {
    return fallback.trim();
  }

  return "file";
}

function getFileBuffer(file) {
  if (Buffer.isBuffer(file?.buffer)) {
    return file.buffer;
  }

  if (Buffer.isBuffer(file?.data)) {
    return file.data;
  }

  return null;
}

function getFilePath(file) {
  if (typeof file?.path === "string" && file.path.trim()) {
    return file.path;
  }

  if (typeof file?.tempFilePath === "string" && file.tempFilePath.trim()) {
    return file.tempFilePath;
  }

  return null;
}

function hasRequestBody(req) {
  return !!req?.body && typeof req.body === "object" && Object.keys(req.body).length > 0;
}

function buildMissingWhitelistError(req, whitelist, fileEntries = []) {
  const receivedKeys = Object.keys(req?.body || {});
  const receivedFileFields = [...new Set(fileEntries.map((entry) => entry.field).filter(Boolean))];
  const allowedKeys = whitelist.length ? whitelist.join(", ") : "(none)";
  const bodyKeys = receivedKeys.length ? receivedKeys.join(", ") : "(none)";
  const fileKeys = receivedFileFields.length ? receivedFileFields.join(", ") : "(none)";

  return new Error(
    `ShortPixelExpress could not find a supported image field in the request. Use one of these keys: ${allowedKeys}. Received body keys: ${bodyKeys}. Received file fields: ${fileKeys}. If you use a custom key, add it via extraWhitelist or overrideWhitelist.`
  );
}

async function getInputSize({ file, fileBuffer, filePath }) {
  const size = Number(file?.size);
  if (Number.isFinite(size) && size >= 0) {
    return size;
  }

  if (fileBuffer) {
    return fileBuffer.length;
  }

  if (!filePath) {
    return null;
  }

  try {
    const stats = await fs.promises.stat(filePath);
    return stats.size;
  } catch {
    return null;
  }
}

function getFileName(file, fallback = "image.bin") {
  if (typeof file?.originalname === "string" && file.originalname.trim()) {
    return file.originalname.trim();
  }

  if (typeof file?.name === "string" && file.name.trim()) {
    return file.name.trim();
  }

  if (typeof file?.filename === "string" && file.filename.trim()) {
    return file.filename.trim();
  }

  return fallback;
}

function mimeTypeFromFilename(filename, fallback = "application/octet-stream") {
  const ext = path.extname(filename || "").toLowerCase();

  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".avif") return "image/avif";
  if (ext === ".svg") return "image/svg+xml";

  return fallback;
}

// override data
async function applyFileResult(file, result) {
  const resultName = result.filename || getFileName(file);

  file.buffer = result.buffer;
  file.size = result.buffer.length;

  if ("data" in file) {
    file.data = result.buffer;
  }

  file.originalname = resultName;
  if ("name" in file) file.name = resultName;
  file.mimetype = mimeTypeFromFilename(resultName, file.mimetype);

  const filePath = getFilePath(file);
  if (!filePath) {
    if ("filename" in file) file.filename = resultName;
    return;
  }

  const currentPath = path.parse(filePath);
  const resultExt = path.extname(resultName);
  const nextPath = resultExt
    ? path.join(currentPath.dir, `${currentPath.name}${resultExt}`)
    : filePath;

  await fs.promises.writeFile(nextPath, result.buffer);

  if (nextPath !== filePath) {
    await fs.promises.unlink(filePath).catch(() => {});
  }

  if ("path" in file) {
    file.path = nextPath;
  }

  if ("tempFilePath" in file) {
    file.tempFilePath = nextPath;
  }

  if ("filename" in file) {
    file.filename = path.basename(nextPath);
  }
}

function buildPathResultPath(filePath, resultName) {
  const sourcePath = path.parse(filePath);
  const resultExt = path.extname(resultName);

  if (!resultExt) {
    return filePath;
  }

  return path.join(sourcePath.dir, `${sourcePath.name}.optimized${resultExt}`);
}

function filterFileEntries(fileEntries, whitelist) {
  const allowed = new Set(whitelist);
  return fileEntries.filter((entry) => allowed.has(entry.field));
}

async function applyPathResult(req, entry, result) {
  const nextPath = buildPathResultPath(entry.value, result.filename || path.basename(entry.value));

  await fs.promises.writeFile(nextPath, result.buffer);

  if (entry.index == null) {
    req.body[entry.field] = nextPath;
    return nextPath;
  }

  req.body[entry.field][entry.index] = nextPath;
  return nextPath;
}

function buildStateEntry({
  kind,
  field = null,
  index = null,
  input,
  sourceValue = null,
  sourceName = null,
  sourcePath = null,
  result,
  outputPath = null
}) {
  return {
    kind,
    field,
    index,
    input,
    source: {
      kind,
      field,
      index,
      value: sourceValue,
      name: sourceName,
      path: sourcePath
    },
    output: {
      filename: result?.filename ?? null,
      path: outputPath,
      size: Buffer.isBuffer(result?.buffer) ? result.buffer.length : null
    },
    ...result,
    ...(outputPath ? { path: outputPath } : {})
  };
}

// Express main entry point
export function ShortPixelExpress(options = {}) {

  // Extract Options and initialize client
  const {
    apiKey,
    extraWhitelist = [],
    blacklist = [],
    overrideWhitelist = null,
    ...apiOptions
  } = options;
  const baseWhitelist = Array.isArray(overrideWhitelist)
    ? overrideWhitelist
    : DEFAULT_WHITELIST;
  const resolvedWhitelist = excludeFieldNames(
    mergeFieldNames(baseWhitelist, extraWhitelist),
    blacklist
  );
  const cli = new ShortPixelClient({ apiKey });
	

  // actual middleware
  return async function shortPixelExpressMiddleware(req, res, next) {
    try {
      const rawFiles = normalizeFiles(req);
      const files = filterFileEntries(rawFiles, resolvedWhitelist);
      const bodyEntries = normalizeBodyStrings(req, resolvedWhitelist);
      const { urls, paths } = splitBodyEntries(bodyEntries);
      // search and extract files, extract body urls

      if (!files.length && !urls.length && !paths.length) {
        if (rawFiles.length || hasRequestBody(req)) {
          throw buildMissingWhitelistError(req, resolvedWhitelist, rawFiles);
        }

        next();
        return;
      }

      const state = getResultState(req);

      // for every file
      for (const entry of files) {
        const file = entry.file;
        const fileBuffer = getFileBuffer(file);
        const filePath = getFilePath(file);
        const originalName = getFileName(file);
        const inputSize = await getInputSize({ file, fileBuffer, filePath });
	// file data
	
        let src = null;

	// file size in range
        if (Number.isFinite(inputSize) && inputSize < MIN_OPTIMIZE_FILE_SIZE) {
          continue;
        }

	// if we found buffer we accordingly optimize
        if (fileBuffer) {
          src = await cli.fromBuffer(fileBuffer, originalName, apiOptions);
        } else if (filePath) {
          src = await cli.fromFile(filePath, apiOptions);
        }

	// failed
        if (!src) {
          continue;
        }

	// store in buffer
        const [result] = await src.downloadToBuffer();
        if (!result?.buffer) {
          throw new Error("ShortPixel did not return an optimized buffer.");
        }

	// override file
        await applyFileResult(file, result);
	// store
        state.files.push(
          buildStateEntry({
            kind: "file",
            field: entry.field,
            index: entry.index,
            input: {
              name: originalName,
              path: filePath
            },
            sourceValue: filePath || originalName,
            sourceName: originalName,
            sourcePath: filePath,
            result,
            outputPath: getFilePath(file)
          })
        );
      }

      // paths
      const optimizablePaths = [];

      for (const entry of paths) {
        const inputSize = await getInputSize({ file: null, fileBuffer: null, filePath: entry.value });
        if (Number.isFinite(inputSize) && inputSize < MIN_OPTIMIZE_FILE_SIZE) {
          continue;
        }

        optimizablePaths.push(entry);
      }

      if (optimizablePaths.length) {
	// generate results
        const pathValues = optimizablePaths.map((entry) => entry.value);
        const src = pathValues.length === 1
          ? await cli.fromFile(pathValues[0], apiOptions)
          : await cli.fromFiles(pathValues, apiOptions);
        const results = await src.downloadToBuffer();

        for (let index = 0; index < results.length; index++) {
          const result = results[index];
          const entry = optimizablePaths[index];

          if (!result?.buffer) {
            throw new Error("ShortPixel did not return an optimized buffer for filepath input.");
          }

	  // override
          const optimizedPath = await applyPathResult(req, entry, result);
	  // save
          state.paths.push(
            buildStateEntry({
              kind: "path",
              field: entry.field,
              index: entry.index,
              input: entry.value,
              sourceValue: entry.value,
              sourceName: path.basename(entry.value),
              sourcePath: entry.value,
              result,
              outputPath: optimizedPath
            })
          );
        }
      }

      if (urls.length) {
        const urlValues = urls.map((entry) => entry.value);
        const src = urlValues.length === 1
          ? await cli.fromUrl(urlValues[0], apiOptions)
          : await cli.fromUrls(urlValues, apiOptions);
        const results = await src.downloadToBuffer();

        for (let index = 0; index < results.length; index++) {
          const result = results[index];
          if (!result?.buffer) {
            throw new Error("ShortPixel did not return an optimized buffer for URL input.");
          }

          state.urls.push(
            buildStateEntry({
              kind: "url",
              field: urls[index].field,
              index: urls[index].index,
              input: urlValues[index],
              sourceValue: urlValues[index],
              sourceName: null,
              sourcePath: null,
              result,
              outputPath: null
            })
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
