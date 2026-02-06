/*
 *
 * THIS IS A TEST
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

const TEST_TAG = "2";
const RUN_ALL_REAL = process.env.RUN_SHORTPIXEL_ALL_REAL === "1";
const RUN_REAL = RUN_ALL_REAL || process.env.RUN_SHORTPIXEL_REAL === TEST_TAG; // RUN ONLY TEST 2 
const API_KEY = process.env.SHORTPIXEL_API_KEY; // get key

const assetsDir = path.join(__dirname, "..", "assets");
const outputDir = path.join(__dirname, "..", "output-real");

const pandaPng = path.join(assetsDir, "panda-small.png");

// ONLY RUN INTEGRATION TEST WHEN RUN_REAL FLAG IS 1!!!
(RUN_REAL ? describe : describe.skip)(`ShortPixel REAL integration [tag ${TEST_TAG}] (optimize + download + save)`, () => {

  var cli;

  beforeAll(async () => {
    if (!fs.existsSync(pandaPng)){
      throw new Error(
        `Missing test assets.\nExpected:\n- ${pandaPng}\nPut them in: test/assets/`
      );
    }
    await fs.promises.mkdir(outputDir, { recursive: true });

    cli = new Client({apiKey : API_KEY});
  });

  test(
    "optimizes panda.png + panda.jpg and saves real optimized images",
    async () => {
      const src = await cli.fromFile(pandaPng, {upscale : 2});

      // 2) Assert ready
      for (const m of src.lastMetas || []) {
        expect(Number(m?.Status?.Code)).toBe(2);
      }

      src.downloadTo(outputDir);
    },
    120000
  );
});
