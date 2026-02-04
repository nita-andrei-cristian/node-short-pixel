import { describe, test, expect } from "@jest/globals";
import SHORTPIXEL from "../main.js";

const { ShortPixelClient } = SHORTPIXEL;

test("Generating a client", () => {
  const client = new ShortPixelClient({ apiKey: "x" });
  expect(client).toBeDefined();
});
