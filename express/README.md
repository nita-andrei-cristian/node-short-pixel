# ShortPixel Express

`ShortPixelExpress` is the Express middleware layer for the ShortPixel Node SDK.

It scans incoming requests for images, sends each supported input to the right ShortPixel API flow, and gives your route handler a request that already contains optimized buffers, rewritten file paths, and normalized result metadata.

If you want the full client API (`ShortPixelClient`, `fromFile`, `optimize`, `upscale`, polling config, typed errors, and so on), see the repository root [README](../README.md) and the official SDK guide:

- [What the SDK actually does](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#what_the_sdk_actually_does)
- [Setting up the client](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#setting_up_the_client)
- [Four ways to think about the API](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#four_ways_to_think_about_the_api)
- [Basic file optimization](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#basic_file_optimization)
- [Optimizing remote URLs](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#optimizing_remote_urls)
- [Format conversion](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#format_conversion)
- [Resizing and upscaling](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#resizing_and_upscaling)
- [Background removal and replacement](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#background_removal_and_replacement)
- [Processing multiple files](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#processing_multiple_files)
- [Working with buffers](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#working_with_buffers)
- [Configuring polling and retries](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#configuring_polling_and_retries)
- [Inspecting metadata](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#inspecting_metadata)
- [Error handling](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#error_handling)
- [Example: Image pipeline for user uploads](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#example_image_pipeline_for_user_uploads)
- [A few things to keep in mind](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#a_few_things_to_keep_in_mind)

## What the middleware actually does

At its core, `ShortPixelExpress` is a request adapter over the SDK client:

- Uploaded buffers go through `fromBuffer(...)`
- Uploaded temp files or disk files go through `fromFile(...)`
- Remote body URLs go through `fromUrl(...)` or `fromUrls(...)`
- Local body paths go through `fromFile(...)` or `fromFiles(...)`

The SDK still handles polling, retries, HTTPS validation, and response normalization.

The middleware handles the Express-specific part:

- reading `req.file`, `req.files`, and `req.body`
- deciding whether each input is an upload, a remote URL, or a local path
- filtering fields through a whitelist / blacklist
- mutating uploaded files and local path fields with optimized outputs
- attaching normalized results to `req.shortPixel`

In practice, you mount it before your route handler, then read `req.shortPixel` or use the already-mutated `req.file`, `req.files`, or `req.body`.

## Installation

```bash
npm i @shortpixel-com/shortpixel
```

The package is ESM-only, so your app should use:

```json
{
  "type": "module"
}
```

Node 20+ is the safest target.

## Setting up the middleware

`ShortPixelExpress` is exported from the package root:

```js
import { ShortPixelExpress } from "@shortpixel-com/shortpixel";
```

Every middleware instance needs a valid ShortPixel API key:

```js
const optimizeImages = ShortPixelExpress({
  apiKey: process.env.SHORTPIXEL_API_KEY,
  lossy: 1,
  convertto: "+webp",
});
```

One important detail: the middleware does not parse the request body for you.

Mount the relevant parsers first:

- `express.json()` or `express.urlencoded()` for body URL / path fields
- `multer`, `express-fileupload`, or another multipart parser for uploaded files

If `apiKey` is missing, middleware creation fails immediately because the underlying SDK client requires it.

## The request flow

The normal Express flow looks like this:

```txt
request
  -> body / multipart parser
  -> ShortPixelExpress(...)
      -> detect supported image inputs
      -> optimize them through the SDK
      -> mutate request data when needed
      -> attach req.shortPixel
  -> your route handler
```

That means downstream handlers do not need to manually call `downloadToBuffer()` or decide which ShortPixel endpoint to hit. The middleware already did that.

## Three input sources the middleware understands

### 1. Uploaded files

The middleware reads uploaded files from:

- `req.file`
- `req.files` as an array
- `req.files` as a keyed object

It works with common upload parser shapes such as:

- `buffer` or `data`
- `path` or `tempFilePath`
- `originalname`, `name`, or `filename`
- `size`

If the upload lives in memory, the middleware optimizes it into a buffer and replaces the file contents in place.

If the upload lives on disk, the middleware writes the optimized bytes back to disk and updates the file metadata on the request object.

Basic upload example:

```js
import express from "express";
import multer from "multer";
import { ShortPixelExpress } from "@shortpixel-com/shortpixel";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.post(
  "/upload",
  upload.single("image"),
  ShortPixelExpress({
    apiKey: process.env.SHORTPIXEL_API_KEY,
    lossy: 1,
    convertto: "+webp",
  }),
  (req, res) => {
    const result = req.shortPixel?.files?.[0];

    res.json({
      optimizedFilename: req.file?.originalname,
      optimizedBytes: req.file?.buffer?.length,
      resultFilename: result?.filename,
      savedToRequest: !!req.file?.buffer,
    });
  }
);
```

### 2. Remote image URLs in `req.body`

Any whitelisted body value that is a non-empty string and parses as a URL is treated as a remote image URL.

Arrays are supported too:

```js
req.body.url = "https://example.com/hero.jpg";
req.body.urls = [
  "https://example.com/a.jpg",
  "https://example.com/b.jpg",
];
```

The middleware optimizes those inputs and stores the results in `req.shortPixel.urls`.

The original body value is not replaced.

Example:

```js
import express from "express";
import { ShortPixelExpress } from "@shortpixel-com/shortpixel";

const app = express();
app.use(express.json());

app.post(
  "/from-url",
  ShortPixelExpress({
    apiKey: process.env.SHORTPIXEL_API_KEY,
    lossy: 1,
    convertto: "+avif",
  }),
  (req, res) => {
    const result = req.shortPixel?.urls?.[0];

    res.json({
      sourceUrl: result?.input,
      filename: result?.filename,
      optimizedBytes: result?.buffer?.length,
    });
  }
);
```

Remote URLs must still use `https://`.

`http://` inputs are detected as URLs by the middleware, but the SDK rejects them before sending the request upstream.

### 3. Local file paths in `req.body`

Any other whitelisted non-empty body string is treated as a local filesystem path.

That includes single values and arrays:

```js
req.body.imagePath = "/tmp/cover.png";
req.body.imagePaths = ["/tmp/a.png", "/tmp/b.png"];
```

Each path is optimized and written next to the original file.

The output filename format is:

```txt
original-name.ext -> original-name.optimized.new-ext
```

After that, the middleware replaces the body value with the new optimized path.

Example:

```js
import express from "express";
import { ShortPixelExpress } from "@shortpixel-com/shortpixel";

const app = express();
app.use(express.json());

app.post(
  "/from-path",
  ShortPixelExpress({
    apiKey: process.env.SHORTPIXEL_API_KEY,
    lossy: 1,
    convertto: "webp",
    extraWhitelist: ["coverPath"],
  }),
  (req, res) => {
    const result = req.shortPixel?.paths?.[0];

    res.json({
      originalPath: result?.input,
      optimizedPath: req.body.coverPath,
      filename: result?.filename,
    });
  }
);
```

## Reading results from `req.shortPixel`

When the request contains at least one supported, whitelisted input, the middleware initializes:

```js
req.shortPixel = {
  files: [],
  urls: [],
  paths: [],
};
```

Each entry in those arrays has this shape:

```js
{
  kind: "file" | "url" | "path",
  input: any,
  field: string | null,
  index: number | null,
  source: {
    kind: "file" | "url" | "path",
    field: string | null,
    index: number | null,
    value: any,
    name: string | null,
    path: string | null
  },
  output: {
    filename: string | null,
    path: string | null,
    size: number | null
  },
  buffer: Buffer,
  meta: any,
  filename: string
}
```

The most useful properties in practice are:

- `result.buffer`: optimized bytes
- `result.filename`: output filename returned by ShortPixel
- `result.meta`: raw SDK metadata for that item
- `result.output.path`: written file path when the middleware saved something to disk
- `result.field`: which request field matched
- `result.index`: array position if the input came from an array

Example:

```js
const fileResult = req.shortPixel?.files?.[0];

console.log(fileResult.kind);         // "file"
console.log(fileResult.field);        // "image"
console.log(fileResult.filename);     // e.g. "photo.webp"
console.log(fileResult.buffer.length);
console.log(fileResult.meta);
```

## How field matching works

The same resolved whitelist is used for all supported input kinds:

- uploaded file field names
- body fields containing remote URLs
- body fields containing local paths

The built-in default field names are:

- URL keys: `url`, `urls`, `imageUrl`, `imageUrls`
- Path keys: `filepath`, `filepaths`, `filePath`, `filePaths`, `imagePath`, `imagePaths`
- File keys: `file`, `files`, `image`, `images`, `upload`, `uploads`

You can customize that behavior with three middleware options:

```js
ShortPixelExpress({
  apiKey,
  extraWhitelist,
  overrideWhitelist,
  blacklist,
  ...shortPixelOptions
});
```

Resolution order is explicit:

1. Start from the default whitelist, or `overrideWhitelist` if you provide it.
2. Merge in `extraWhitelist`.
3. Remove any keys listed in `blacklist`.

Examples:

```js
ShortPixelExpress({
  apiKey: process.env.SHORTPIXEL_API_KEY,
  extraWhitelist: ["cover", "heroUrl"],
});
```

```js
ShortPixelExpress({
  apiKey: process.env.SHORTPIXEL_API_KEY,
  overrideWhitelist: ["cover", "gallery"],
  blacklist: ["gallery"],
});
```

The second example only accepts `cover`.

One practical warning: for body values, any whitelisted non-URL string is treated as a local path. Do not whitelist generic text fields unless they really contain image paths.

## Express-specific options

The middleware adds five Express-facing options on top of the forwarded SDK options:

- `apiKey`: required
- `passthrough`: default `false`
- `extraWhitelist`: additional accepted field names
- `overrideWhitelist`: replaces the defaults entirely
- `blacklist`: removes fields after whitelist resolution

Everything else is forwarded to the underlying SDK calls.

That means you can pass normal ShortPixel API options directly on the middleware:

- `lossy`
- `convertto`
- `resize`
- `resize_width`
- `resize_height`
- `upscale`
- background removal / replacement options
- and other options supported by the main SDK

Useful client-side references for those forwarded options:

- [Format conversion](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#format_conversion)
- [Resizing and upscaling](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#resizing_and_upscaling)
- [Background removal and replacement](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#background_removal_and_replacement)
- [Configuring polling and retries](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#configuring_polling_and_retries)
- [Inspecting metadata](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#inspecting_metadata)
- [Error handling](https://shortpixel.com/blog/how-to-optimize-images-in-node-js-with-the-shortpixel-sdk/#error_handling)

Example:

```js
ShortPixelExpress({
  apiKey: process.env.SHORTPIXEL_API_KEY,
  lossy: 2,
  convertto: "+webp|+avif",
  keep_exif: 0,
});
```

## What gets mutated on the request

### Uploaded files

Uploaded files are mutated in place.

For memory uploads:

- `file.buffer` becomes the optimized buffer
- `file.data` also becomes the optimized buffer when present
- `file.size` is updated
- `file.originalname` is updated to the returned filename
- `file.name` and `file.filename` are updated when present
- `file.mimetype` is recalculated from the returned filename

For disk-backed uploads:

- the optimized bytes are written back to disk
- the file can be renamed if the output extension changes
- `file.path`, `file.tempFilePath`, and `file.filename` are updated when present

### Local body paths

Local path inputs are written to a sibling output file and the matching body field is replaced with that new path.

### Remote body URLs

Remote URL inputs are not written back into `req.body`.

They only appear in `req.shortPixel.urls`.

## Global middleware pattern

If you want to mount `ShortPixelExpress` once at app level, use `passthrough: true`.

That lets unmatched requests continue without error, which is useful when only some routes carry images.

Example:

```js
import express from "express";
import multer from "multer";
import { ShortPixelExpress } from "@shortpixel-com/shortpixel";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (!req.is?.("multipart/form-data")) {
    next();
    return;
  }

  upload.any()(req, res, next);
});

app.use(
  ShortPixelExpress({
    apiKey: process.env.SHORTPIXEL_API_KEY,
    passthrough: true,
    lossy: 1,
    convertto: "+webp",
  })
);
```

This pattern works well when you want one central optimization layer instead of adding the middleware route by route.

## Error handling

The middleware always calls `next(error)` on failure.

That includes:

- SDK auth, quota, temporary, or invalid-request errors
- filesystem errors when reading local paths or writing optimized outputs
- invalid HTTPS inputs rejected by the SDK
- requests that contain files or body data, but nothing matches the resolved whitelist

A standard Express error handler is enough:

```js
app.use((error, req, res, next) => {
  res.status(500).json({
    error: error.name,
    message: error.message,
  });
});
```

One nuance matters here:

- If a request is completely empty, the middleware just calls `next()`.
- If a request contains body data or uploaded files but none of the field names match the whitelist, the middleware throws unless `passthrough` is `true`.

The whitelist error message includes:

- the accepted keys
- the received body keys
- the uploaded file field names found on the request

## Skip rules

Uploads and local file paths smaller than `50_000` bytes are skipped.

That means:

- they do not throw
- they are not added to `req.shortPixel`
- uploaded file objects stay unchanged
- local body paths stay unchanged

Remote URLs are not filtered by that size rule.

## A practical mental model

If you need one sentence to remember the middleware:

`ShortPixelExpress` is the "inspect the request, optimize whatever matches, then hand me normalized results on req" layer on top of the SDK.

Use it when your app already lives in Express and you want image optimization to feel like normal middleware rather than manual client orchestration in every route.
