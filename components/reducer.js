/*
 * ShortPixel reducer entry point.
 */

import { pickBestOutputUrl } from "./reducer/pick-best-output-url";
import {
  Source,
  fromUrl,
  fromUrls,
  fromURLs,
  fromBuffer,
  fromBuffers,
  fromFile,
  fromFiles
} from "./reducer/source";
import { config as _config } from "./config";

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
