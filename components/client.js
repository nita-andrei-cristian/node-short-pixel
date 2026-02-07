/**
 * Hello!
 * 
 * This is the main entry point for the client of Short Pixel API
 * In case you don't know ShortPixel is an image optimization tool.
 *
 * ShortPixel supports optimizing images, as well as upscaling, replacing background and more.
 *
 * ------ BASICS
 * Please see the README.md or docs for this module for basic usage and examples.
 *
 * Here is the idea in short form, the CLI is an interface with creates an abstract
 * wrapper over ShortPixel functionality. The main functions are fromFile, fromBuffer, fromUrl and plurals. The plurals (fromFiles, fromBuffers, fromUrls) are meant to batch process tasks in parallel for increased performance. 
 *
 * It's advisable to visit the official docs : https://shortpixel.com/api-docs for configuration information
 *
 * You can upscale any image, you can replace transparent background with other images and so much more. Check the official docs for info.
 * 
 * -------- HANDLING ERRORS
 *
 *  Errors are handled by sp codes, you can see all of them here [https://shortpixel.com/api-docs]. SP codes are often along an SP message that explains the error in a human readable way.
 *
 *  Note : The SP codes 1 and 2 are positive indicators : 1 = image being processed 2 = image processed
 *
 * -------- ADVANCED USAGE
 * You may edit the default behaviour of the client via the set(name,value) property, here is the default configuration
 *
  key: "",
  plugin_version: "NP001",
  timeout: 30000, (ms, if request don't conclude before timeout, the processes are stopped)
  retries: 2, (how many times a request is retried if fails)
  retryDelay: 800, (ms)
  wait: 20,
  convertto: null, (this forces all items to respect a certain format, don't worry, you can always set a conversion default per call)
  poll: {
    enabled: true,
    interval: 1500,
    maxAttempts: 12
  }
 *
 * You may also create a source by yourself altough is not recommended. (The property Source exposes the class)
 *
 * Note : Proxy can be configured in the constructor (or via set("proxy", value)).
 *
*/

import {
  Source,
  fromUrl,
  fromUrls,
  fromURLs,
  fromBuffer,
  fromBuffers,
  fromFile,
  fromFiles,
  _config
} from "./reducer.js";

const DEFAULT_BUFFER_NAME = "image.bin";
const URL_PROTOCOL_RE = /^https?:$/i;

function isUrlString(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return URL_PROTOCOL_RE.test(parsed.protocol);
  } catch {
    return false;
  }
}

function isBufferLikeEntry(value) {
  return (
    Buffer.isBuffer(value) ||
    (value && typeof value === "object" && "buffer" in value)
  );
}

function isFileLikeEntry(value) {
  return (
    typeof value === "string" ||
    (value && typeof value === "object" && ("filename" in value || "buffer" in value))
  );
}

class Client {

  constructor({ apiKey = "", pluginVersion = "NP001", proxy = null } = {}) {
    if (!apiKey) {
      throw new Error("ShortPixel API key is required");
    }

    _config.key = apiKey;
    _config.plugin_version = pluginVersion;

    if (proxy) {
      _config.proxy = proxy;
    }
  }

  set(name, value){
    if (Object.prototype.hasOwnProperty.call(_config, name))
      _config[name] = value;
  }

  // CORE FUNCTIONALITY

  async fromUrl(url, options) {
    return await fromUrl(url, options);
  }
  async fromUrls(urls, options) {
    return await fromUrls(urls, options);
  }
  async fromURLs(urls, options) {
    return await fromURLs(urls, options);
  }

  async fromBuffer(buffer, filename, options) {
    return await fromBuffer(buffer, filename, options);
  }
  async fromBuffers(buffers, defaultName, options) {
    return await fromBuffers(buffers, defaultName, options);
  }

  async fromFile(path, options) {
    return await fromFile(path, options);
  }
  async fromFiles(paths, options) {
    return await fromFiles(paths, options);
  }

  /**
   * User-friendly aliases for default optimization helpers.
   */
  async optimizeUrl(url, options) {
    return await this.fromUrl(url, options);
  }
  async optimizeUrls(urls, options) {
    return await this.fromUrls(urls, options);
  }

  async optimizeBuffer(buffer, filename, options) {
    return await this.fromBuffer(buffer, filename, options);
  }
  async optimizeBuffers(buffers, defaultName, options) {
    return await this.fromBuffers(buffers, defaultName, options);
  }

  async optimizeFile(path, options) {
    return await this.fromFile(path, options);
  }
  async optimizeFiles(paths, options) {
    return await this.fromFiles(paths, options);
  }

  // even more abstract functionality, this allows optimizing without specifying any type
  _splitOptimizeOptions(options = {}) {
    const {
      filename = null,
      defaultName = null,
      ...apiOptions
    } = options || {};

    return { filename, defaultName, apiOptions };
  }

  /* converts the array of inputs to the most likely optimize function (while keeping the properties) */
  // notice that only defaultname and filename are used in specific cases, such as local files and buffers.
  async _optimizeMany(inputs, { filename, defaultName, apiOptions }) {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new Error("optimize expects a non-empty list when input is an array.");
    }

    const hasUrlStrings = inputs.some((item) => typeof item === "string" && isUrlString(item));
    const hasPathStrings = inputs.some((item) => typeof item === "string" && !isUrlString(item));
    if (hasUrlStrings && hasPathStrings) {
      throw new Error("Cannot mix local paths and URLs in a single optimize array.");
    }

    if (inputs.every((item) => typeof item === "string" && isUrlString(item))) {
      return await this.fromUrls(inputs, apiOptions);
    }

    if (inputs.every((item) => item && typeof item === "object" && typeof item.url === "string")) {
      return await this.fromUrls(inputs.map((item) => item.url), apiOptions);
    }

    if (inputs.every((item) => isBufferLikeEntry(item))) {
      const name = defaultName || filename || DEFAULT_BUFFER_NAME;
      return await this.fromBuffers(inputs, name, apiOptions);
    }

    if (inputs.every((item) => isFileLikeEntry(item))) {
      return await this.fromFiles(inputs, apiOptions);
    }

    throw new Error("Unsupported optimize array input. Use URLs, file paths, or buffers.");
  }

  // takes an input and tries to figure out how to optimize it
  async _optimizeObject(input, { filename, defaultName, apiOptions }) {
    const scopedOptions = {
      ...(input.options && typeof input.options === "object" ? input.options : {}),
      ...apiOptions
    };

    if (Array.isArray(input.urls)) {
      return await this.fromUrls(input.urls, scopedOptions);
    }
    if (typeof input.url === "string") {
      return await this.fromUrl(input.url, scopedOptions);
    }

    if (Array.isArray(input.files)) {
      return await this.fromFiles(input.files, scopedOptions);
    }
    if (typeof input.file === "string") {
      return await this.fromFile(input.file, scopedOptions);
    }
    if (typeof input.path === "string") {
      return await this.fromFile(input.path, scopedOptions);
    }
    if (typeof input.filename === "string") {
      if (Buffer.isBuffer(input.buffer)) {
        return await this.fromBuffer(input.buffer, input.filename, scopedOptions);
      }
      return await this.fromFile(input.filename, scopedOptions);
    }

    if (Array.isArray(input.buffers)) {
      const name = input.defaultName || defaultName || filename || DEFAULT_BUFFER_NAME;
      return await this.fromBuffers(input.buffers, name, scopedOptions);
    }
    if (Buffer.isBuffer(input.buffer)) {
      const name = input.filename || filename || DEFAULT_BUFFER_NAME;
      return await this.fromBuffer(input.buffer, name, scopedOptions);
    }

    throw new Error("Unsupported optimize object input.");
  }

  /**
   * Generic optimization dispatcher:
   * - URL string/object -> reducer
   * - file path/object  -> post-reducer
   * - buffer/object     -> post-reducer
   * - arrays route to the corresponding batch helper
   */
  async optimize(input, options = {}) {
    // here we inject the options into apiOptions
    const { filename, defaultName, apiOptions } = this._splitOptimizeOptions(options);

    if (input == null) {
      throw new Error("optimize requires an input (url/path/buffer/list/object).");
    }

    if (Buffer.isBuffer(input)) {
      const name = filename || DEFAULT_BUFFER_NAME;
      return await this.fromBuffer(input, name, apiOptions);
    }

    if (typeof input === "string") {
      if (isUrlString(input)) return await this.fromUrl(input, apiOptions);
      return await this.fromFile(input, apiOptions);
    }

    if (Array.isArray(input)) {
      return await this._optimizeMany(input, { filename, defaultName, apiOptions });
    }

    if (input && typeof input === "object") {
      return await this._optimizeObject(input, { filename, defaultName, apiOptions });
    }

    throw new Error("Unsupported optimize input type.");
  }

  // here are really just a bunch of aliases for different features.
  _withFeature(input, featureOptions, options = {}) {
    return this.optimize(input, { ...featureOptions, ...options });
  }

  async lossless(input, options = {}) {
    return await this._withFeature(input, { lossy: 0 }, options);
  }

  async lossy(input, options = {}) {
    return await this._withFeature(input, { lossy: 1 }, options);
  }

  async glossy(input, options = {}) {
    return await this._withFeature(input, { lossy: 2 }, options);
  }

  async wait(input, seconds, options = {}) {
    return await this._withFeature(input, { wait: seconds }, options);
  }

  async upscale(input, factor = 2, options = {}) {
    return await this._withFeature(input, { upscale: factor }, options);
  }

  async rescale(input, width, height, options = {}) {
    return await this._withFeature(
      input,
      { resize: 1, resize_width: width, resize_height: height },
      options
    );
  }

  async resizeOuter(input, width, height, options = {}) {
    return await this.rescale(input, width, height, options);
  }

  async resizeInner(input, width, height, options = {}) {
    return await this._withFeature(
      input,
      { resize: 3, resize_width: width, resize_height: height },
      options
    );
  }

  async smartCrop(input, width, height, options = {}) {
    return await this._withFeature(
      input,
      { resize: 4, resize_width: width, resize_height: height },
      options
    );
  }

  async convert(input, convertto, options = {}) {
    return await this._withFeature(input, { convertto }, options);
  }

  async cmykToRgb(input, enabled = true, options = {}) {
    return await this._withFeature(input, { cmyk2rgb: enabled ? 1 : 0 }, options);
  }

  async keepExif(input, enabled = true, options = {}) {
    return await this._withFeature(input, { keep_exif: enabled ? 1 : 0 }, options);
  }

  async backgroundChange(input, background = 1, options = {}) {
    return await this._withFeature(input, { bg_remove: background }, options);
  }

  async backgroundRemove(input, options = {}) {
    return await this.backgroundChange(input, 1, options);
  }

  async refresh(input, enabled = true, options = {}) {
    return await this._withFeature(input, { refresh: enabled ? 1 : 0 }, options);
  }

  /**
   * Expose Source (advanced usage)
   */
  Source(){
	return Source;	
  }

}

export default Client;
