/*
 * ShortPixel reducer entry point.
 */

import { pickBestOutputUrl } from "./reducer/pick-best-output-url.js";
import {
  Source,
  fromUrl,
  fromUrls,
  fromURLs,
  fromBuffer,
  fromBuffers,
  fromFile,
  fromFiles
} from "./reducer/source.js";
import { config as _config } from "./config.js";

export {
  Source,
  fromUrl,
  fromUrls,
  fromURLs,
  fromBuffer,
  fromBuffers,
  fromFile,
  fromFiles,
  _config,

  // helpers (optional export)
  pickBestOutputUrl
};
