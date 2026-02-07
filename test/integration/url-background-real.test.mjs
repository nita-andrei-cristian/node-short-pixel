/*
 * URL input + background URL replacement integration coverage.
 * Enable via RUN_SHORTPIXEL_REAL=6 or RUN_SHORTPIXEL_ALL_REAL=1.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Client from "../../components/client.js";
import { pickBestOutputUrl } from "../../components/reducer/pick-best-output-url.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_TAG = "6";
const RUN_ALL_REAL = process.env.RUN_SHORTPIXEL_ALL_REAL === "1";
const RUN_REAL = RUN_ALL_REAL || process.env.RUN_SHORTPIXEL_REAL === TEST_TAG;
const API_KEY = process.env.SHORTPIXEL_API_KEY;

const assetsDir = path.join(__dirname, "..", "assets");
const outputDir = path.join(__dirname, "..", "output-real");

const pandaSmall = path.join(assetsDir, "panda-small.png");
const remoteSourceUrl = "https://images.unsplash.com/photo-1506744038136-46273834b3fb";
const remoteBackgroundUrl = "https://images.unsplash.com/photo-1501785888041-af3ef285b470";

const outputFor = async (name) => {
  const dir = path.join(outputDir, `tag6-${name}`.replace(/\s+/g, "-").toLowerCase());
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
};

const assertReady = (src, options = {}, expectedExt = null) => {
  expect(src).toBeTruthy();
  expect(Array.isArray(src.lastMetas)).toBe(true);
  expect(src.lastMetas.length).toBeGreaterThan(0);

  for (const meta of src.lastMetas || []) {
    expect(Number(meta?.Status?.Code)).toBe(2);

    const best = pickBestOutputUrl(meta, options);
    expect(best).toBeTruthy();

    if (expectedExt) {
      expect(String(best).toLowerCase()).toContain(`.${expectedExt}`);
    }
  }
};

(RUN_REAL ? describe : describe.skip)(`ShortPixel REAL integration [tag ${TEST_TAG}] (url + background-url)`, () => {
  let cli;
  const urlCases = [
    {
      name: "url-optimize",
      options: { lossy: 1, convertto: "+webp" },
      expectedExt: "webp",
      run: () => cli.fromUrl(remoteSourceUrl, { lossy: 1, convertto: "+webp" }),
    },
    {
      name: "background-url",
      options: { bg_remove: remoteBackgroundUrl, convertto: "+webp" },
      expectedExt: "webp",
      run: () => cli.backgroundChange(pandaSmall, remoteBackgroundUrl, { convertto: "+webp" }),
    },
  ];

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
    cli = new Client({ apiKey: API_KEY });
    cli.set("poll", { enabled: true, interval: 2000, maxAttempts: 30 });
  });

  test.concurrent.each(urlCases)("runs URL scenario: $name", async ({ name, run, options, expectedExt }) => {
    const src = await run();
    assertReady(src, options, expectedExt);
    const files = await src.downloadTo(await outputFor(name));
    expect(files.length).toBe(1);
  }, 300000);
});
