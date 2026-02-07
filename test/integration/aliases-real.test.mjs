/*
 * Real-world alias coverage.
 * Enable via RUN_SHORTPIXEL_REAL=4 or RUN_SHORTPIXEL_ALL_REAL=1
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Client from "../../components/client.js";

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_TAG = "4";
const RUN_ALL_REAL = process.env.RUN_SHORTPIXEL_ALL_REAL === "1";
const RUN_REAL = RUN_ALL_REAL || process.env.RUN_SHORTPIXEL_REAL === TEST_TAG;
const API_KEY = process.env.SHORTPIXEL_API_KEY;

const assetsDir = path.join(__dirname, "..", "assets");
const outputDir = path.join(__dirname, "..", "output-real");

const pandaSmall = path.join(assetsDir, "panda-small.png");
const remoteUrlA = "https://images.unsplash.com/photo-1506744038136-46273834b3fb";
const remoteUrlB = "https://images.unsplash.com/photo-1501785888041-af3ef285b470";

const outputFor = async (name) => {
  const dir = path.join(outputDir, `aliases-${name}`.replace(/\s+/g, "-").toLowerCase());
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
};

const assertReady = (src, minItems = 1) => {
  expect(src).toBeTruthy();
  expect(Array.isArray(src.lastMetas)).toBe(true);
  expect(src.lastMetas.length).toBeGreaterThanOrEqual(minItems);

  for (const meta of src.lastMetas || []) {
    expect(Number(meta?.Status?.Code)).toBe(2);
  }
};

const runAlias = async (name, fn, minItems = 1) => {
  const src = await fn();
  assertReady(src, minItems);
  const files = await src.downloadTo(await outputFor(name));
  expect(files.length).toBeGreaterThanOrEqual(minItems);
};

// ONLY RUN INTEGRATION TEST WHEN RUN_REAL FLAG IS 1!!!
(RUN_REAL ? describe : describe.skip)(`ShortPixel REAL integration [tag ${TEST_TAG}] (aliases)`, () => {
  let cli;
  let pandaBuffer;
  const aliasCases = [
    {
      name: "optimize-file",
      run: () => cli.optimizeFile(pandaSmall, { lossy: 1 }),
    },
    {
      name: "optimize-files",
      run: () => cli.optimizeFiles([pandaSmall, pandaSmall], { lossy: 1 }),
      minItems: 2,
    },
    {
      name: "optimize-buffer",
      run: () => cli.optimizeBuffer(pandaBuffer, "alias-buffer.png", { lossy: 1 }),
    },
    {
      name: "optimize-buffers",
      run: () =>
        cli.optimizeBuffers(
          [
            { buffer: pandaBuffer, filename: "alias-buffer-1.png" },
            { buffer: pandaBuffer, filename: "alias-buffer-2.png" },
          ],
          "alias-default.png",
          { lossy: 1 }
        ),
      minItems: 2,
    },
    {
      name: "optimize-url",
      run: () => cli.optimizeUrl(remoteUrlA, { lossy: 1 }),
    },
    {
      name: "optimize-urls",
      run: () => cli.optimizeUrls([remoteUrlA, remoteUrlB], { lossy: 1 }),
      minItems: 2,
    },
    {
      name: "optimize-dispatch-file",
      run: () => cli.optimize(pandaSmall, { lossy: 1 }),
    },
    {
      name: "optimize-dispatch-url",
      run: () => cli.optimize(remoteUrlA, { lossy: 1 }),
    },
    {
      name: "optimize-dispatch-buffer",
      run: () => cli.optimize(pandaBuffer, { filename: "dispatch-buffer.png", lossy: 1 }),
    },
    {
      name: "optimize-dispatch-object",
      run: () => cli.optimize({ filename: pandaSmall }, { lossy: 1 }),
    },
    {
      name: "lossless",
      run: () => cli.lossless(pandaSmall),
    },
    {
      name: "lossy",
      run: () => cli.lossy(pandaSmall),
    },
    {
      name: "glossy",
      run: () => cli.glossy(pandaSmall),
    },
    {
      name: "wait",
      run: () => cli.wait(pandaSmall, 0),
    },
    {
      name: "upscale",
      run: () => cli.upscale(pandaSmall, 2),
    },
    {
      name: "rescale",
      run: () => cli.rescale(pandaSmall, 800, 600),
    },
    {
      name: "resize-outer",
      run: () => cli.resizeOuter(pandaSmall, 820, 620),
    },
    {
      name: "resize-inner",
      run: () => cli.resizeInner(pandaSmall, 320, 320),
    },
    {
      name: "smart-crop",
      run: () => cli.smartCrop(pandaSmall, 300, 200),
    },
    {
      name: "convert",
      run: () => cli.convert(pandaSmall, "+webp"),
    },
    {
      name: "cmyk-to-rgb",
      run: () => cli.cmykToRgb(pandaSmall, true),
    },
    {
      name: "keep-exif",
      run: () => cli.keepExif(pandaSmall, true),
    },
    {
      name: "background-change",
      run: () => cli.backgroundChange(pandaSmall, "#ff0080"),
    },
    {
      name: "background-remove",
      run: () => cli.backgroundRemove(pandaSmall),
    },
    {
      name: "refresh",
      run: () => cli.refresh(pandaSmall, true),
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
    pandaBuffer = await fs.promises.readFile(pandaSmall);

    cli = new Client({ apiKey: API_KEY });
    cli.set("poll", { enabled: true, interval: 2000, maxAttempts: 25 });
  });

  test.concurrent.each(aliasCases)(
    "runs alias scenario: $name",
    async ({ name, run, minItems = 1 }) => {
      await runAlias(name, run, minItems);
    },
    300000
  );
});
