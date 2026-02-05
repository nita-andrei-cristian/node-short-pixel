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

import Client from "../../components/client"

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUN_REAL = process.env.RUN_SHORTPIXEL_REAL === "1"; // disable on unit tests
const API_KEY = process.env.SHORTPIXEL_API_KEY; // get key

const assetsDir = path.join(__dirname, "..", "assets"); // here the tests assets lie (a panda.png and panda.jpg in this case)
const outputDir = path.join(__dirname, "..", "output-real");

const pandaPng = path.join(assetsDir, "panda.png"); // there are two panda images in png and jps in assetsDir
const pandaJpg = path.join(assetsDir, "panda.jpg");

// ONLY RUN INTEGRATION TEST WHEN RUN_REAL FLAG IS 1!!!
(RUN_REAL ? describe : describe.skip)("ShortPixel REAL integration (optimize + download + save)", () => {

  var cli;

  beforeAll(async () => {
    if (!fs.existsSync(pandaPng) || !fs.existsSync(pandaJpg)) {
      throw new Error(
        `Missing test assets.\nExpected:\n- ${pandaPng}\n- ${pandaJpg}\nPut them in: test/assets/`
      );
    }
    await fs.promises.mkdir(outputDir, { recursive: true });

    cli = new Client({apiKey : API_KEY});
  });

  test(
    "optimizes panda.png + panda.jpg and saves real optimized images",
    async () => {
      const src = await cli.fromFiles([pandaPng, pandaJpg]);

      // 2) Assert ready
      for (const m of src.lastMetas || []) {
        expect(Number(m?.Status?.Code)).toBe(2);
      }

      src.downloadTo(outputDir);
    },
    120000
  );
});

