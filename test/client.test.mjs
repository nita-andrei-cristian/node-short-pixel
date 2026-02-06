import { describe, test, expect, jest } from "@jest/globals";
import SHORTPIXEL from "../main.js";

const { ShortPixelClient } = SHORTPIXEL;

test("Generating a client", () => {
  const client = new ShortPixelClient({ apiKey: "x" });
  expect(client).toBeDefined();
});

describe("Client aliases and feature helpers", () => {
  test("optimizeFile proxies to fromFile", async () => {
    const client = new ShortPixelClient({ apiKey: "x" });
    const expected = { ok: true };
    client.fromFile = jest.fn().mockResolvedValue(expected);

    const src = await client.optimizeFile("/tmp/demo.png", { lossy: 0 });

    expect(client.fromFile).toHaveBeenCalledWith("/tmp/demo.png", { lossy: 0 });
    expect(src).toBe(expected);
  });

  test("upscale and backgroundChange merge feature defaults with additional options", async () => {
    const client = new ShortPixelClient({ apiKey: "x" });
    client.optimize = jest.fn().mockResolvedValue({ ok: true });

    await client.upscale("/tmp/demo.png", 2, { lossy: 2, convertto: "+webp" });
    await client.backgroundChange("/tmp/demo.png", "#00ff0080", { keep_exif: 1 });

    expect(client.optimize).toHaveBeenNthCalledWith(1, "/tmp/demo.png", {
      upscale: 2,
      lossy: 2,
      convertto: "+webp",
    });
    expect(client.optimize).toHaveBeenNthCalledWith(2, "/tmp/demo.png", {
      bg_remove: "#00ff0080",
      keep_exif: 1,
    });
  });

  test("rescale allows option overrides for advanced behavior", async () => {
    const client = new ShortPixelClient({ apiKey: "x" });
    client.optimize = jest.fn().mockResolvedValue({ ok: true });

    await client.rescale("/tmp/demo.png", 320, 200, { resize: 3, lossy: 1 });

    expect(client.optimize).toHaveBeenCalledWith("/tmp/demo.png", {
      resize: 3,
      resize_width: 320,
      resize_height: 200,
      lossy: 1,
    });
  });

  test("optimize dispatches URL/path/buffer to matching helper", async () => {
    const client = new ShortPixelClient({ apiKey: "x" });
    client.fromUrl = jest.fn().mockResolvedValue({ kind: "url" });
    client.fromFile = jest.fn().mockResolvedValue({ kind: "file" });
    client.fromBuffer = jest.fn().mockResolvedValue({ kind: "buffer" });

    const buf = Buffer.from("abc");
    await client.optimize("https://images.unsplash.com/photo-1506744038136-46273834b3fb", { lossy: 2 });
    await client.optimize("test/assets/panda-small.png", { wait: 0 });
    await client.optimize(buf, { filename: "panda.png", convertto: "+avif" });

    expect(client.fromUrl).toHaveBeenCalledWith(
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
      { lossy: 2 }
    );
    expect(client.fromFile).toHaveBeenCalledWith("test/assets/panda-small.png", { wait: 0 });
    expect(client.fromBuffer).toHaveBeenCalledWith(buf, "panda.png", { convertto: "+avif" });
  });

  test("optimize supports object shape with filename as local file input", async () => {
    const client = new ShortPixelClient({ apiKey: "x" });
    client.fromFile = jest.fn().mockResolvedValue({ kind: "file" });

    await client.optimize({ filename: "test/assets/panda-small.png" }, { lossy: 2 });

    expect(client.fromFile).toHaveBeenCalledWith("test/assets/panda-small.png", { lossy: 2 });
  });
});
