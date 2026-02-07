/*
 * Basic real integration test with optional proxy.
 * Enable via RUN_SHORTPIXEL_REAL=5 or RUN_SHORTPIXEL_ALL_REAL=1.
 * Pass PROXY="" to run direct, or PROXY="http://host:port" to force proxy.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Client from "../../components/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_TAG = "5";
const RUN_ALL_REAL = process.env.RUN_SHORTPIXEL_ALL_REAL === "1";
const RUN_REAL = RUN_ALL_REAL || process.env.RUN_SHORTPIXEL_REAL === TEST_TAG;
const API_KEY = process.env.SHORTPIXEL_API_KEY;

const RAW_PROXY = typeof process.env.PROXY === "string" ? process.env.PROXY.trim() : "";
const PROXY = RAW_PROXY || null;

const assetsDir = path.join(__dirname, "..", "assets");
const outputDir = path.join(__dirname, "..", "output-real");
const pandaSmall = path.join(assetsDir, "panda-small.png");

const outputFor = async (name) => {
  const suffix = PROXY ? "with-proxy" : "no-proxy";
  const dir = path.join(outputDir, `${name}-${suffix}`.toLowerCase());
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
};

(RUN_REAL ? describe : describe.skip)(`ShortPixel REAL integration [tag ${TEST_TAG}] (basic proxy)`, () => {
  let cli;

  beforeAll(async () => {
    if (!API_KEY) {
      throw new Error("SHORTPIXEL_API_KEY is required for real integration tests.");
    }
    if (!fs.existsSync(pandaSmall)) {
      throw new Error(
        `Missing test assets.\nExpected:\n- ${pandaSmall}\nPut them in: test/assets/`
      );
    }

    await fs.promises.mkdir(outputDir, { recursive: true });
    cli = new Client({ apiKey: API_KEY, proxy: PROXY });
    cli.set("poll", { enabled: true, interval: 2000, maxAttempts: 20 });
  });

  test("optimizes one local file and downloads result using proxy-aware transport", async () => {
    const src = await cli.fromFile(pandaSmall, { lossy: 1 });

    for (const meta of src.lastMetas || []) {
      expect(Number(meta?.Status?.Code)).toBe(2);
    }

    const files = await src.downloadTo(await outputFor("proxy-basic"));
    expect(files.length).toBe(1);
  }, 120000);
});
