/*
 * Comprehensive real-world reducer/post-reducer tests using panda-small.png
 * Each block is tagged; enable via RUN_SHORTPIXEL_REAL=<tag> or RUN_SHORTPIXEL_ALL_REAL=1
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Client from "../../components/client"
import { pickBestOutputUrl } from "../../components/reducer/pick-best-output-url";

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_TAG = "3";
const RUN_ALL_REAL = process.env.RUN_SHORTPIXEL_ALL_REAL === "1";
const RUN_REAL = RUN_ALL_REAL || process.env.RUN_SHORTPIXEL_REAL === TEST_TAG;
const API_KEY = process.env.SHORTPIXEL_API_KEY; // get key

const assetsDir = path.join(__dirname, "..", "assets");
const outputDir = path.join(__dirname, "..", "output-real");

const pandaSmall = path.join(assetsDir, "panda-small.png");

const testOutput = async (name) => {
  const dir = path.join(outputDir, name.replace(/\\s+/g, "-").toLowerCase());
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
};

const expectBestUrl = (meta, opts, expectedExts = []) => {
  const best = pickBestOutputUrl(meta, opts);
  expect(best).toBeTruthy();
  if (expectedExts.length) {
    const url = String(best).toLowerCase();
    const match = expectedExts.some((ext) => url.includes(`.${ext}`) || url.includes(ext));
    expect(match).toBe(true);
  }
};

const expectFileIsImage = async (dir) => {
  const files = await fs.promises.readdir(dir);
  expect(files.length).toBeGreaterThan(0);
  const data = await fs.promises.readFile(path.join(dir, files[0]));
  const isJpeg = data[0] === 0xff && data[1] === 0xd8;
  const isPng = data[0] === 0x89 && data[1] === 0x50;
  expect(isJpeg || isPng).toBe(true);
};

// ONLY RUN INTEGRATION TEST WHEN RUN_REAL FLAG IS 1!!!
(RUN_REAL ? describe : describe.skip)(`ShortPixel REAL integration [tag ${TEST_TAG}] (panda-small scenarios)`, () => {

  let cli;

  beforeAll(async () => {
    if (!fs.existsSync(pandaSmall)){
      throw new Error(
        `Missing test assets.\nExpected:\n- ${pandaSmall}\nPut them in: test/assets/`
      );
    }
    await fs.promises.mkdir(outputDir, { recursive: true });

    cli = new Client({apiKey : API_KEY});
    cli.set("poll", {enabled : true, interval : 2000, maxAttempts : 20});
  });

  test("lossless optimize via postReducer", async () => {
    const src = await cli.fromFile(pandaSmall, { lossy: 0 });
    for (const m of src.lastMetas || []) {
      expect(Number(m?.Status?.Code)).toBe(2);
      expectBestUrl(m, { lossy: 0 });
    }
    await src.downloadTo(await testOutput("lossless"));
  }, 120000);

  test("glossy + webp convert", async () => {
    const src = await cli.fromFile(pandaSmall, { lossy: 2, convertto: "+webp" });
    for (const m of src.lastMetas || []) {
      expect(Number(m?.Status?.Code)).toBe(2);
      expectBestUrl(m, { lossy: 2, convertto: "+webp" }, ["webp"]);
    }
    await src.downloadTo(await testOutput("glossy-webp"));
  }, 120000);

  test("outer resize to 1024x768 + avif convert", async () => {
    const src = await cli.fromFile(pandaSmall, {
      resize: 1,
      resize_width: 1024,
      resize_height: 768,
      convertto: "+avif",
    });
    for (const m of src.lastMetas || []) {
      expect(Number(m?.Status?.Code)).toBe(2);
      expectBestUrl(m, { resize: 1, resize_width: 1024, resize_height: 768, convertto: "+avif" }, ["avif"]);
    }
    await src.downloadTo(await testOutput("resize-outer-avif"));
  }, 120000);

  test("inner resize square 400 + keep_exif", async () => {
    const src = await cli.fromFile(pandaSmall, {
      resize: 3,
      resize_width: 400,
      resize_height: 400,
      keep_exif: 1,
    });
    for (const m of src.lastMetas || []) {
      expect(Number(m?.Status?.Code)).toBe(2);
      expectBestUrl(m, { resize: 3, resize_width: 400, resize_height: 400, keep_exif: 1 });
    }
    await src.downloadTo(await testOutput("resize-inner-keep-exif"));
  }, 120000);

  test("smart crop 300x200 + bg remove transparent", async () => {
    const src = await cli.fromFile(pandaSmall, {
      resize: 4,
      resize_width: 300,
      resize_height: 200,
      bg_remove: 1,
      convertto: "+webp",
    });
    for (const m of src.lastMetas || []) {
      expect(Number(m?.Status?.Code)).toBe(2);
      expectBestUrl(m, { resize: 4, resize_width: 300, resize_height: 200, bg_remove: 1, convertto: "+webp" }, ["webp"]);
    }
    await src.downloadTo(await testOutput("smartcrop-bgremove"));
  }, 300000);

  test("upscale x3 + dual convert", async () => {
    const src = await cli.fromFile(pandaSmall, {
      upscale: 3,
      convertto: "+webp|+avif",
    });
    for (const m of src.lastMetas || []) {
      expect(Number(m?.Status?.Code)).toBe(2);
      expectBestUrl(m, { upscale: 3, convertto: "+webp|+avif" }, ["avif", "webp"]);
    }
    await src.downloadTo(await testOutput("upscale3-dual"));
  }, 120000);

  test("wait=0 poll path", async () => {
    const src = await cli.fromFile(pandaSmall, {
      wait: 0,
      convertto: "+webp",
    });
    for (const m of src.lastMetas || []) {
      expect(Number(m?.Status?.Code)).toBe(2);
      expectBestUrl(m, { wait: 0, convertto: "+webp" }, ["webp"]);
    }
    await src.downloadTo(await testOutput("wait0-webp"));
  }, 120000);

  test("convert to jpg with cmyk2rgb", async () => {
    const src = await cli.fromFile(pandaSmall, {
      cmyk2rgb: 1,
      convertto: "jpg",
    });
    for (const m of src.lastMetas || []) {
      expect(Number(m?.Status?.Code)).toBe(2);
      expectBestUrl(m, { cmyk2rgb: 1, convertto: "jpg" }); // url may be extensionless
    }
    const dir = await testOutput("convert-jpg-cmyk");
    await src.downloadTo(dir);
    await expectFileIsImage(dir);
  }, 120000);

  test("batch two files lossy + webp", async () => {
    const src = await cli.fromFiles([pandaSmall, pandaSmall], {
      lossy: 1,
      convertto: "+webp",
    });
    for (const m of src.lastMetas || []) {
      expect(Number(m?.Status?.Code)).toBe(2);
      expectBestUrl(m, { lossy: 1, convertto: "+webp" }, ["webp"]);
    }
    await src.downloadTo(await testOutput("batch-lossy-webp"));
  }, 120000);

  test("bg remove to solid color and glossy", async () => {
    const src = await cli.fromFile(pandaSmall, {
      resize: 4,
      resize_width: 320,
      resize_height: 180,
      bg_remove: "#00ff0080",
      lossy: 2,
      convertto: "+webp",
    });
    for (const m of src.lastMetas || []) {
      expect(Number(m?.Status?.Code)).toBe(2);
      expectBestUrl(m, { resize: 4, bg_remove: "#00ff0080", lossy: 2, convertto: "+webp" }, ["webp"]);
    }
    await src.downloadTo(await testOutput("bgremove-green"));
  }, 300000);

  test("upscale x4 lossless keep_exif", async () => {
    const src = await cli.fromFile(pandaSmall, {
      upscale: 4,
      lossy: 0,
      keep_exif: 1,
    });
    for (const m of src.lastMetas || []) {
      expect(Number(m?.Status?.Code)).toBe(2);
      expectBestUrl(m, { upscale: 4, lossy: 0, keep_exif: 1 });
    }
    await src.downloadTo(await testOutput("upscale4-lossless"));
  }, 120000);

  test("long wait glossy avif", async () => {
    const src = await cli.fromFile(pandaSmall, {
      wait: 25,
      lossy: 2,
      convertto: "+avif",
    });
    for (const m of src.lastMetas || []) {
      expect(Number(m?.Status?.Code)).toBe(2);
      expectBestUrl(m, { wait: 25, lossy: 2, convertto: "+avif" }, ["avif"]);
    }
    await src.downloadTo(await testOutput("wait25-glossy-avif"));
  }, 120000);
});
