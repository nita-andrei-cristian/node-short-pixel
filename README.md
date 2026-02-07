# node-shortpixel

A Node.js SDK for the ShortPixel API with an ergonomics-first design: you can use explicit helpers (`fromFile`, `fromUrl`) or a highly abstracted interface (`optimize`, `upscale`, `rescale`, `backgroundChange`, and more).

This is the complete, final documentation for the current API surface in this repository.

## Table of Contents

1. [What this SDK solves](#what-this-sdk-solves)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Mental model: Client + Source + Meta](#mental-model-client--source--meta)
5. [Abstraction layers](#abstraction-layers)
6. [Full client API reference](#full-client-api-reference)
7. [Supported API parameters](#supported-api-parameters)
8. [Practical examples (cookbook)](#practical-examples-cookbook)
9. [Power User Guide](#power-user-guide)
10. [Errors, retry, debugging](#errors-retry-debugging)
11. [Running tests](#running-tests)
12. [Important notes](#important-notes)

---

## What this SDK solves

ShortPixel exposes two main endpoints:

- Reducer API: optimizes images from remote URLs.
- Post-Reducer API: optimizes local files or buffers uploaded as multipart.

This SDK hides transport details, polling, retry strategy, and response normalization, while still giving you full access to API options.

In short:

- Want explicit control: use `fromFile`, `fromUrl`, etc.
- Want fast and simple DX: use `optimize(...)` and feature-first helpers (`upscale`, `rescale`, `backgroundChange`, etc).
- Want advanced control: use `Source`, inspect `lastMetas`, tune polling/retries/timeouts.

---

## Installation
* To be uploaded to npm

```bash
npm install node-shortpixel
```

In this local repository, the main import is:

```js
import SHORTPIXEL from "./main.js";
```

When consumed as a published package, typical usage is:

```js
import SHORTPIXEL from "node-shortpixel";
```

### Runtime requirements

- ESM (`"type": "module"`)
- Modern Node.js (ideally Node 20+)

---

## Quick Start

```js
import SHORTPIXEL from "./main.js";

const { ShortPixelClient } = SHORTPIXEL;
const cli = new ShortPixelClient({
  apiKey: process.env.SHORTPIXEL_API_KEY,
});

const src = await cli.upscale("test/assets/panda-small.png", 2, {
  lossy: 2,
  convertto: "+webp",
});

const files = await src.downloadTo("test/output-real");
console.log(files);
```

Desired feature-first style:

```js
const src = await cli.upscale("/path/input.png", 2);
await src.downloadTo("/path/output");
```

---

## Mental model: Client + Source + Meta

### `ShortPixelClient`

This is the entry point. It can:

- configure API key and defaults,
- accept multiple input forms,
- route to the correct ShortPixel endpoint,
- expose higher-level abstractions.

### `Source`

Each operation returns a `Source`.

`Source` contains:

- `lastMetas`: metadata returned by the API for the latest operation,
- `lastResults`: input-to-meta mapping,
- `downloadTo(outputDir)`: downloads optimized outputs locally.

### `Meta`

Each optimized item has metadata with status (`Status.Code`) and output URLs (`LossyURL`, `LosslessURL`, `WebP*`, `AVIF*`, etc).

---

## Abstraction layers

The SDK is intentionally designed with multiple abstraction layers. Use the one that matches your team and use case.

## Layer 1: explicit helpers (`from*`)

Classic and very explicit:

- `fromUrl(url, options)`
- `fromUrls(urls, options)`
- `fromURLs(urls, options)` (alias)
- `fromFile(path, options)`
- `fromFiles(pathsOrObjects, options)`
- `fromBuffer(buffer, filename, options)`
- `fromBuffers(buffersOrObjects, defaultName, options)`

Advantages:

- clear endpoint intent (Reducer vs Post-Reducer)
- easy to reason about in large codebases

## Layer 2: intent-first aliases (`optimize*`)

Same operations, naming focused on user intent:

- `optimizeUrl`, `optimizeUrls`
- `optimizeFile`, `optimizeFiles`
- `optimizeBuffer`, `optimizeBuffers`

Advantages:

- more natural naming for most developers

## Layer 3: generic dispatcher `optimize(input, options)`

Pass input, and the SDK routes automatically.

### Supported input shapes

- URL string -> `fromUrl`
- local path string -> `fromFile`
- `Buffer` -> `fromBuffer`
- array of URLs -> `fromUrls`
- array of file paths/entries -> `fromFiles`
- array of buffers/entries -> `fromBuffers`
- object shapes:
  - `{ url }`, `{ urls }`
  - `{ file }`, `{ path }`, `{ filename }`
  - `{ buffer, filename? }`, `{ buffers, defaultName? }`, `{ files }`

### Important rule

Do not mix remote URLs and local paths in the same string array (`optimize(["https://...", "./a.png"])` throws).

## Layer 4: feature-first helpers

Methods that set feature defaults, then allow full override via `options`:

- quality: `lossless`, `lossy`, `glossy`
- resize/upscale: `upscale`, `rescale`, `resizeOuter`, `resizeInner`, `smartCrop`
- background: `backgroundChange`, `backgroundRemove`
- format: `convert`
- metadata/color: `keepExif`, `cmykToRgb`
- workflow: `wait`, `refresh`

These methods are intelligent aliases built on top of `optimize(...)`.

---

## Full client API reference

### Constructor

```js
new ShortPixelClient({ apiKey, pluginVersion = "NP001", proxy = null })
```

- `apiKey` is required.
- `pluginVersion` must be a string with max 5 characters. Altough it's optional
- ```proxy``` is yed to be implmented

### Runtime config

```js
cli.set(name, value)
```

Useful keys:

- `timeout` (ms)
- `retries`
- `retryDelay` (ms)
- `wait`
- `convertto`
- `poll` -> `{ enabled, interval, maxAttempts }`

#### Important
Please considering increasing the poll interval and maxAttempts if the polling process fails due to timeout. This is required on complex operations like background-removal or smart resizing.

### Core helpers

- `fromUrl(url, options)`
- `fromUrls(urls, options)`
- `fromURLs(urls, options)`
- `fromFile(path, options)`
- `fromFiles(pathsOrEntries, options)`
- `fromBuffer(buffer, filename, options)`
- `fromBuffers(buffersOrEntries, defaultName, options)`

### `optimize*` aliases

  Those are yet to be tested in real environments

- `optimize(input, options)`
- `optimizeUrl(url, options)`
- `optimizeUrls(urls, options)`
- `optimizeFile(path, options)`
- `optimizeFiles(paths, options)`
- `optimizeBuffer(buffer, filename, options)`
- `optimizeBuffers(buffers, defaultName, options)`

### Feature-first aliases

  Those are yet to be tested in real environments

- `lossless(input, options)` -> `lossy: 0`
- `lossy(input, options)` -> `lossy: 1`
- `glossy(input, options)` -> `lossy: 2`
- `wait(input, seconds, options)` -> `wait: seconds`
- `upscale(input, factor = 2, options)` -> `upscale: factor`
- `rescale(input, width, height, options)` -> `resize: 1`
- `resizeOuter(input, width, height, options)` -> alias of `rescale`
- `resizeInner(input, width, height, options)` -> `resize: 3`
- `smartCrop(input, width, height, options)` -> `resize: 4`
- `convert(input, convertto, options)` -> `convertto`
- `cmykToRgb(input, enabled = true, options)` -> `cmyk2rgb`
- `keepExif(input, enabled = true, options)` -> `keep_exif`
- `backgroundChange(input, background = 1, options)` -> `bg_remove`
- `backgroundRemove(input, options)` -> `bg_remove: 1`
- `refresh(input, enabled = true, options)` -> `refresh`

See the Official documentation for more information : https://shortpixel.com/api-docs

### Source exposure

```js
const SourceCtor = cli.Source();
```

---

## Supported API parameters

Any ShortPixel-supported parameter can be passed via `options`.

### Common parameters

| Parameter | Purpose | SDK usage |
|---|---|---|
| `key` | API key | constructor `new ShortPixelClient({ apiKey })` |
| `plugin_version` | client identifier (max 5 chars) | constructor `pluginVersion` |
| `lossy` | 0=lossless, 1=lossy, 2=glossy | `options.lossy` or `lossless/lossy/glossy` |
| `wait` | wait seconds in API call | `options.wait` or `wait(...)` |
| `upscale` | 0,2,3,4 | `options.upscale` or `upscale(...)` |
| `resize` | 0 none, 1 outer, 3 inner, 4 smart crop | `options.resize` or `rescale/resizeInner/smartCrop` |
| `resize_width` | resize width | `options.resize_width` |
| `resize_height` | resize height | `options.resize_height` |
| `cmyk2rgb` | CMYK -> RGB conversion | `options.cmyk2rgb` or `cmykToRgb(...)` |
| `keep_exif` | preserve EXIF | `options.keep_exif` or `keepExif(...)` |
| `convertto` | output conversion (webp/avif/etc) | `options.convertto` or `convert(...)` |
| `bg_remove` | remove/change background | `options.bg_remove` or `backgroundChange(...)` |
| `refresh` | refetch/re-optimize source | `options.refresh` or `refresh(...)` |
| `urllist` | URL list payload | handled internally by `fromUrl(s)`/`optimize` |
| `paramlist` | per-URL settings for reducer batch | `options.paramlist` |
| `returndatalist` | custom payload echoed by API | `options.returndatalist` |

### Local SDK validations

Before requests are sent, the SDK validates at minimum:

- `pluginVersion` max 5 chars
- `wait` in `[0..30]`
- `upscale` in `{0,2,3,4}`
- if `resize > 0`, valid dimensions are required

---

## Practical examples (cookbook)

## 1) Basic local file optimization

```js
const src = await cli.fromFile("test/assets/panda-small.png", { lossy: 1 });
await src.downloadTo("test/output-real");
```

## 2) User-friendly alias

```js
const src = await cli.optimizeFile("test/assets/panda-small.png", { lossy: 2 });
await src.downloadTo("test/output-real");
```

## 3) Generic optimization without specifying input type

```js
// URLS HAVEN'T BEEN TESTED YET
const srcA = await cli.optimize("test/assets/panda-small.png", { lossy: 0 });
const srcB = await cli.optimize("https://images.unsplash.com/photo-1506744038136-46273834b3fb", { lossy: 1 });
const srcC = await cli.optimize(Buffer.from("..."), { filename: "upload.png", lossy: 2 });
```

## 4) Upscale

```js
const src = await cli.upscale("test/assets/panda-small.png", 4, {
  lossy: 0,
  keep_exif: 1,
});
await src.downloadTo("test/output-real");
```

## 5) Rescale (outer)

```js
const src = await cli.rescale("test/assets/panda-small.png", 1024, 768, {
  convertto: "+avif",
});
await src.downloadTo("test/output-real");
```

## 6) Resize inner

```js
const src = await cli.resizeInner("test/assets/panda-small.png", 400, 400, {
  keep_exif: 1,
});
await src.downloadTo("test/output-real");
```

## 7) Smart crop

```js
const src = await cli.smartCrop("test/assets/panda-small.png", 300, 200, {
  convertto: "+webp",
});
await src.downloadTo("test/output-real");
```

## 8) Background remove / change

Transparent output:

```js
const src = await cli.backgroundRemove("test/assets/panda-small.png", {
  convertto: "+webp",
});
await src.downloadTo("test/output-real");
```

Solid color + alpha (`#rrggbbxx`):

```js
const src = await cli.backgroundChange("test/assets/panda-small.png", "#00ff0080", {
  lossy: 2,
  convertto: "+webp",
});
await src.downloadTo("test/output-real");
```

Custom background image URL:

```js
const src = await cli.backgroundChange(
  "test/assets/panda-small.png",
  "https://example.com/background.jpg",
  { convertto: "+webp" }
);
await src.downloadTo("test/output-real");
```

## 9) Format conversions

Original + WebP:

```js
await cli.convert("test/assets/panda-small.png", "+webp");
```

WebP + AVIF only (no original optimization):

```js
await cli.convert("test/assets/panda-small.png", "webp|avif");
```

Original + WebP + AVIF:

```js
await cli.convert("test/assets/panda-small.png", "+webp|+avif");
```

## 10) Local file batch

```js
const src = await cli.fromFiles([
  "test/assets/panda-small.png",
  "test/assets/panda-small.png",
], {
  lossy: 1,
  convertto: "+webp",
});

await src.downloadTo("test/output-real");
```

## 11) URL batch

```js
// URLS HAVEN'T BEEN TESTED YET
const src = await cli.fromUrls([
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb"
], {
  lossy: 2,
  convertto: "+avif",
});

await src.downloadTo("test/output-real");
```

## 12) Buffer batch

```js
const b1 = Buffer.from("...");
const b2 = Buffer.from("...");

const src = await cli.fromBuffers([
  { buffer: b1, filename: "one.png" },
  { buffer: b2, filename: "two.png" },
], "fallback.bin", {
  lossy: 1,
});

await src.downloadTo("test/output-real");
```

## Power User Guide

Use this when you want deep control over runtime behavior, observability, and tuning.

## 1) Tune global transport settings

```js
cli.set("timeout", 45000);
cli.set("retries", 4);
cli.set("retryDelay", 1000);
```

## 2) Tune polling behavior

```js
cli.set("poll", {
  enabled: true,
  interval: 2000,
  maxAttempts: 20,
});
```

When API responses come back with pending status (`Status.Code = 1`), the SDK polls until ready (`2`) or until attempt budget is exhausted.

## 3) Global default output format

```js
cli.set("convertto", "+webp");
```

Any call without an explicit `options.convertto` inherits `+webp`.

## 4) Inspect per-item metadata

```js
const src = await cli.fromFile("test/assets/panda-small.png", {
  lossy: 2,
  convertto: "+webp|+avif",
});

for (const m of src.lastMetas || []) {
  console.log("Code:", Number(m?.Status?.Code));
  console.log("Message:", m?.Status?.Message);
  console.log("LossyURL:", m?.LossyURL);
  console.log("WebP:", m?.WebPLossyURL || m?.WebPLosslessURL);
  console.log("AVIF:", m?.AVIFLossyURL || m?.AVIFLosslessURL);
}
```

## 5) Run the flow manually with `Source`

If you need maximum internals control:

```js
const SourceCtor = cli.Source();
const src = new SourceCtor({ filename: "test/assets/panda-small.png" });

src.setOptions({
  lossy: 2,
  upscale: 2,
  convertto: "+webp",
});

await src.postReducer();
console.log(src.lastMetas);

await src.downloadTo("test/output-real");
```

For URL-based flows, call `src.reducer()` instead of `postReducer()`.

## 6) Handle download manually (without `downloadTo`)

`downloadTo` is convenient, but you can use metadata URLs directly for custom naming/storage (S3, object stores, CDN pipelines, etc).

```js
CODE IN PROGRESS
```

## 7) Override feature defaults intentionally

Feature helpers set defaults, but `options` has priority:

```js
await cli.lossless("test/assets/panda-small.png", {
  lossy: 2,
});
```

The call above effectively runs with `lossy: 2`.

---

## Errors, retry, debugging

The SDK uses typed errors:

- `ShortPixelError`
- `ShortPixelAuthError`
- `ShortPixelQuotaError`
- `ShortPixelTemporaryError`
- `ShortPixelInvalidRequestError`
- `ShortPixelBatchError`

Error objects may include:

- `httpStatus`
- `spCode`
- `spMessage`
- `payload`

Recommended handling pattern:

```js
// YET TO BE TESTED
try {
  const src = await cli.fromFile("test/assets/panda-small.png", { upscale: 9 });
  await src.downloadTo("test/output-real");
} catch (err) {
  console.error("name:", err?.name);
  console.error("spCode:", err?.spCode);
  console.error("spMessage:", err?.spMessage);
  console.error("httpStatus:", err?.httpStatus);
  console.error("payload:", err?.payload);
}
```

### `ShortPixelBatchError`

In batch mode, one or more failed items can raise `ShortPixelBatchError`, which includes `items` (index, input, meta/error per item).

### Retry behavior

Retry is used for temporary failures (for example 429, 5xx, temporary SP codes). Configure via:

- `retries`
- `retryDelay`
- `timeout`

---

## Running tests

Unit tests:

```bash
npm test
```

Real API integration tests (consume ShortPixel credits):

```bash
RUN_SHORTPIXEL_REAL=1 SHORTPIXEL_API_KEY="your-key" npm test
```

Run specific integration groups:

```bash
RUN_SHORTPIXEL_REAL=2 SHORTPIXEL_API_KEY="your-key" npm test
RUN_SHORTPIXEL_REAL=3 SHORTPIXEL_API_KEY="your-key" npm test
RUN_SHORTPIXEL_REAL=4 SHORTPIXEL_API_KEY="your-key" npm test
RUN_SHORTPIXEL_ALL_REAL=1 SHORTPIXEL_API_KEY="your-key" npm test
```

---

## Important notes

1. `apiKey` is required.
2. `pluginVersion` must be max 5 characters. (optional)
3. `downloadTo()` only works after an optimization call (`from*`, `optimize*`, `optimize`, feature helpers).
4. In `optimize([...])`, do not mix URL strings and local path strings.
5. All feature helpers (`upscale`, `rescale`, `backgroundChange`, etc.) support additional options, so you can combine capabilities in a single call.
6. Increase poll time if anything breaks and retry.

---

Official ShortPixel API docs: `https://shortpixel.com/api-docs`
