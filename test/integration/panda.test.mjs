/*
 *
 * THIS IS A TEST
 * Currently this is not documented, please enter on this repo in 24h from now
 *
 *
 * */ 

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { Source, _config } from "../../components/reducer.js";

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUN_REAL = process.env.RUN_SHORTPIXEL_REAL === "1"; // disable on unit tests
const API_KEY = process.env.SHORTPIXEL_API_KEY; // get key

const assetsDir = path.join(__dirname, "..", "assets"); // here the tests assets lie (a panda.png and panda.jpg in this case)
const outputDir = path.join(__dirname, "..", "output-real");

const pandaPng = path.join(assetsDir, "panda.png"); // there are two panda images in png and jps in assetsDir
const pandaJpg = path.join(assetsDir, "panda.jpg");

const REDUCER_URL = "https://api.shortpixel.com/v2/reducer.php"; //

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// See https://www.w3.org/TR/png/#5PNG-file-signature
function isPng(buf) {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

// Same but for jpg signature
function isJpg(buf) {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

// extracts url
function pickBestUrl(meta, lossy = 1) {
  // No WebP/AVIF dependency: use PNG/JPG outputs.
  if (lossy > 0 && meta?.LossyURL && meta.LossyURL !== "NA") return meta.LossyURL;
  if (meta?.LosslessURL && meta.LosslessURL !== "NA") return meta.LosslessURL;
  return null;
}

// Polls the files until they are ready
async function pollReducerUntilReady(originalUrls, { key, plugin_version, lossy, wait, intervalMs, maxAttempts }) {
  let urls = [...originalUrls];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const payload = {
      key,
      plugin_version,
      lossy,
      wait,
      urllist: urls
    };

    const res = await fetch(REDUCER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("Unexpected reducer response.");

    // If any still pending, keep polling only those
    const pending = data.filter((m) => Number(m?.Status?.Code) === 1).map((m) => m.OriginalURL);
    const allDone = data.every((m) => Number(m?.Status?.Code) === 2);

    if (allDone) return data;

    urls = pending;
    await sleep(intervalMs);
  }

  throw new Error("Timed out waiting for ShortPixel optimization (still pending).");
}

// ONLY RUN INTEGRATION TEST WHEN RUN_REAL FLAG IS 1!!!
(RUN_REAL ? describe : describe.skip)("ShortPixel REAL integration (optimize + download + save)", () => {

  beforeAll(async () => {
    if (!fs.existsSync(pandaPng) || !fs.existsSync(pandaJpg)) {
      throw new Error(
        `Missing test assets.\nExpected:\n- ${pandaPng}\n- ${pandaJpg}\nPut them in: test/assets/`
      );
    }
    await fs.promises.mkdir(outputDir, { recursive: true });

    _config.key = API_KEY;
    _config.poll.enabled = true;
    _config.poll.maxAttempts = 12;
    _config.poll.interval = 1500;
    _config.wait = 20;
  });

  test(
    "optimizes panda.png + panda.jpg and saves real optimized images",
    async () => {
      const options = {
        lossy: 1,
        wait: 20,
        keep_exif: 0,
        cmyk2rgb: 1
        // IMPORTANT: no convertto here -> ShortPixel returns optimized PNG/JPG (WebP/AVIF will be NA)
      };

      const src = new Source({});
      src.files = [{ filename: pandaPng }, { filename: pandaJpg }];

      // 1) Upload (post-reducer)
      let metas = await src.setOptions(options).postReducer();

      // 2) If any pending => poll reducer.php with OriginalURLs
      const pendingOriginals = metas
        .filter((m) => Number(m?.Status?.Code) === 1 && typeof m?.OriginalURL === "string")
        .map((m) => m.OriginalURL);

      if (pendingOriginals.length) {
        const polled = await pollReducerUntilReady(pendingOriginals, {
          key: API_KEY,
          plugin_version: _config.plugin_version,
          lossy: options.lossy,
          wait: options.wait,
          intervalMs: 1500,
          maxAttempts: 12
        });

        // Merge back by OriginalURL
        const byUrl = new Map(polled.map((m) => [m.OriginalURL, m]));
        metas = metas.map((m) => (byUrl.has(m.OriginalURL) ? byUrl.get(m.OriginalURL) : m));
      }

      // 3) Assert ready
      for (const m of metas) {
        expect(Number(m?.Status?.Code)).toBe(2);
      }

      // 4) Download & save
      for (const meta of metas) {
        const url = pickBestUrl(meta, options.lossy);
        expect(url).toBeTruthy();

        const res = await fetch(url, { redirect: "follow" });
        expect(res.ok).toBe(true);

        const buf = Buffer.from(await res.arrayBuffer());
        expect(buf.length).toBeGreaterThan(100); // sanity check 

        const outName = path.basename(url).split("?")[0];
        const outPath = path.join(outputDir, outName);
        await fs.promises.writeFile(outPath, buf);

        // 5) Validate we saved a real image (not HTML)
        const ext = path.extname(outName).toLowerCase();
        if (ext === ".png") expect(isPng(buf)).toBe(true);
        if (ext === ".jpg" || ext === ".jpeg") expect(isJpg(buf)).toBe(true);
      }
    },
    120000
  );
});

