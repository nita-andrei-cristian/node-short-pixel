import { describe, test, expect, afterEach, jest } from "@jest/globals";
import fs from "fs";
import os from "os";
import path from "path";
import SHORTPIXEL from "../main.js";
import { config } from "../components/config.js";
import { fetchWithTimeout } from "../components/common-utils.js";
import { Source } from "../components/reducer/source.js";

const { ShortPixelClient } = SHORTPIXEL;

const BASE_CONFIG = {
  key: config.key,
  plugin_version: config.plugin_version,
  proxy: config.proxy,
  timeout: config.timeout,
  retries: config.retries,
  retryDelay: config.retryDelay,
  wait: config.wait,
  convertto: config.convertto,
  poll: { ...config.poll }
};

const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  config.key = BASE_CONFIG.key;
  config.plugin_version = BASE_CONFIG.plugin_version;
  config.proxy = BASE_CONFIG.proxy;
  config.timeout = BASE_CONFIG.timeout;
  config.retries = BASE_CONFIG.retries;
  config.retryDelay = BASE_CONFIG.retryDelay;
  config.wait = BASE_CONFIG.wait;
  config.convertto = BASE_CONFIG.convertto;
  config.poll = { ...BASE_CONFIG.poll };
  global.fetch = ORIGINAL_FETCH;
});

describe("Network security and proxy behavior", () => {
  test("rejects non-HTTPS request targets before fetch is attempted", async () => {
    global.fetch = jest.fn();

    await expect(fetchWithTimeout("http://example.com/image.jpg", {}, 50)).rejects.toMatchObject({
      name: "ShortPixelInvalidRequestError"
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("allows HTTP proxy config but still rejects HTTP optimization URLs", async () => {
    const client = new ShortPixelClient({
      apiKey: "x",
      proxy: "http://127.0.0.1:8080"
    });
    global.fetch = jest.fn();

    let err = null;
    try {
      await client.fromUrl("http://example.com/panda.jpg");
    } catch (e) {
      err = e;
    }

    expect(err).toBeTruthy();
    expect(err.name).toBe("ShortPixelInvalidRequestError");
    expect(err.message).toMatch(/https/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("downloadTo upgrades HTTP output metadata URL to HTTPS", async () => {
    const src = new Source();
    src.lastMetas = [
      {
        Status: { Code: 2, Message: "Image processed" },
        LossyURL: "http://example.com/optimized.jpg",
        LosslessURL: "NA"
      }
    ];
    src.lastResults = [{ input: { displayName: "input.png" }, meta: src.lastMetas[0] }];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
    });

    const outDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sp-download-"));
    try {
      const files = await src.downloadTo(outDir, { timeout: 1000 });
      expect(files.length).toBe(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][0]).toBe("https://example.com/optimized.jpg");
    } finally {
      await fs.promises.rm(outDir, { recursive: true, force: true });
    }
  });
});
