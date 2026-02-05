
/**
 * Hello!
 * 
 * This is the main entry point for the client of Short Pixel API
 * In case you don't know ShortPixel is an image optimization tool.
 *
 * ShortPixel supports optimizing images, as well as upscaling, replacing background and more.
 *
 * ------ BASICS
 *
 * This node package should cover all of the necesities via this client
 * the client works by plugging in an apiKey and has the following helper functions:
 *
 * 1.fromUrl
 * 2.fromUrls
 * 3.fromBuffer
 * 4.fromBuffers
 * 5.fromFile
 * 6.fromFiles
 *
 * The plurals (2,4,6) support batch uploading which means the images are being processed
 * all at once in paralell.
 *
 * 1. and 2. use the Reducer API for optimizing a url image, where 3-6 utilize the POST-REDUCER API to optimize
 * an image file (which can be an actual local file or a buffer)
 *
 * All functions 1-6 return a 'Source', the 'Source' can be configured via the second parameter of functions 1-6
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
 * Note : Proxy is not yet implemented.
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
    if (_config[name] != null)
      _config[name] = value;
  }

  /**
   * HELPLERS
   */
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
   * Expose Source (advanced usage)
   */
  Source(){
	return Source;	
  }

}

export default Client;
