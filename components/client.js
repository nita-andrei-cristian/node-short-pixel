// client.js
import {
  Source,
  fromUrl,
  fromBuffer,
  fromFile,
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

  /**
   * Factory helpers (SDK style)
   */
  fromUrl(url) {
    return fromUrl(url);
  }

  fromBuffer(buffer, filename) {
    return fromBuffer(buffer, filename);
  }

  fromFile(path) {
    return fromFile(path);
  }

  /**
   * Expose Source (advanced usage)
   */
  Source() {
    return Source;
  }
}

export default Client;

