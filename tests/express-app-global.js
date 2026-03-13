import express from "express";
import multer from "multer";
import { ShortPixelExpress } from "../main.js";

const app = express();
app.use(express.urlencoded({ extended: true }));
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 3011);

const shortPixelOptions = {
  apiKey: process.env.SHORTPIXEL_API_KEY,
  lossy: 1,
  convertto: process.env.SHORTPIXEL_CONVERTTO || null
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function guessMimeType(originalMime, convertto) {
  const convert = typeof convertto === "string" ? convertto.toLowerCase() : "";

  if (convert.includes("webp")) return "image/webp";
  if (convert.includes("avif")) return "image/avif";
  if (convert.includes("png")) return "image/png";
  if (convert.includes("jpeg") || convert.includes("jpg")) return "image/jpeg";

  return originalMime || "application/octet-stream";
}

function toDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function renderPage({ original, optimized, error, form = {} } = {}) {
  const resultMarkup = error
    ? `<section class="result error"><h2>Optimization failed</h2><pre>${escapeHtml(error)}</pre></section>`
    : original && optimized
      ? `
        <section class="grid">
          <article class="card">
            <h2>Original</h2>
            <p><strong>Name:</strong> ${escapeHtml(original.name)}</p>
            <p><strong>Type:</strong> ${escapeHtml(original.mimeType)}</p>
            <p><strong>Size:</strong> ${escapeHtml(formatBytes(original.size))}</p>
            <img src="${original.dataUrl}" alt="Original upload preview">
          </article>
          <article class="card">
            <h2>Optimized</h2>
            <p><strong>Name:</strong> ${escapeHtml(optimized.name)}</p>
            <p><strong>Type:</strong> ${escapeHtml(optimized.mimeType)}</p>
            <p><strong>Size:</strong> ${escapeHtml(formatBytes(optimized.size))}</p>
            <img src="${optimized.dataUrl}" alt="Optimized upload preview">
          </article>
        </section>
      `
      : "";

  const urlPanel = optimized && optimized.sourceUrl
    ? `
        <section class="grid">
          <article class="card">
            <h2>Original URL</h2>
            <p><strong>URL:</strong> ${escapeHtml(optimized.sourceUrl)}</p>
            <img src="${optimized.sourceUrl}" alt="Original URL preview">
          </article>
          <article class="card">
            <h2>Optimized from URL</h2>
            <p><strong>Name:</strong> ${escapeHtml(optimized.name)}</p>
            <p><strong>Type:</strong> ${escapeHtml(optimized.mimeType)}</p>
            <p><strong>Size:</strong> ${escapeHtml(formatBytes(optimized.size))}</p>
            <img src="${optimized.dataUrl}" alt="Optimized URL preview">
          </article>
        </section>
      `
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ShortPixel Express Global Demo</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe7;
        --panel: #fffdf9;
        --ink: #14213d;
        --muted: #5b6475;
        --line: #d7cbbd;
        --accent: #e76f51;
        --accent-dark: #b84d32;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background:
          radial-gradient(circle at top left, rgba(231,111,81,0.15), transparent 30%),
          linear-gradient(180deg, #fbf6ef 0%, var(--bg) 100%);
        color: var(--ink);
      }

      main {
        max-width: 1040px;
        margin: 0 auto;
        padding: 48px 20px 64px;
      }

      h1 {
        margin: 0 0 12px;
        font-size: clamp(2.1rem, 4vw, 3.4rem);
      }

      .lead {
        margin: 0 0 28px;
        color: var(--muted);
        font-size: 1.05rem;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 18px 44px rgba(20, 33, 61, 0.08);
      }

      form {
        display: grid;
        gap: 14px;
        align-items: start;
      }

      input[type="file"],
      input[type="url"] {
        border: 1px dashed var(--line);
        border-radius: 12px;
        padding: 14px;
        background: #fff;
        font: inherit;
      }

      button {
        width: fit-content;
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        font: inherit;
        color: #fff;
        background: linear-gradient(135deg, var(--accent), var(--accent-dark));
        cursor: pointer;
      }

      .hint {
        margin: 0;
        color: var(--muted);
        font-size: 0.95rem;
      }

      .grid {
        display: grid;
        gap: 18px;
        margin-top: 24px;
      }

      .card, .result {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 20px;
        box-shadow: 0 18px 44px rgba(20, 33, 61, 0.08);
      }

      .card h2, .result h2 {
        margin-top: 0;
      }

      .card img {
        display: block;
        width: 100%;
        max-height: 420px;
        object-fit: contain;
        margin-top: 16px;
        border-radius: 14px;
        background: #f3eee6;
      }

      .error pre {
        white-space: pre-wrap;
        margin: 0;
        color: #7d2b1a;
      }

      @media (min-width: 780px) {
        .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>ShortPixel Express Global Demo</h1>
      <p class="lead">Mount ShortPixel once with <code>app.use(ShortPixelExpress(...))</code> and let matching requests be optimized automatically.</p>
      <section class="panel">
        <form action="/upload" method="post" enctype="multipart/form-data">
          <input type="file" name="image" accept="image/*" required>
          <button type="submit">Upload and optimize</button>
          <p class="hint">This example parses multipart requests globally, then runs ShortPixel globally with <code>passthrough: true</code>.</p>
        </form>
      </section>
      <section class="panel" style="margin-top: 18px;">
        <form action="/url" method="post">
          <input type="url" name="sourceUrl" placeholder="https://example.com/image.jpg" value="${escapeHtml(form.sourceUrl || "")}" required>
          <button type="submit">Optimize remote URL</button>
          <p class="hint">The form always maps <code>sourceUrl</code> into the default ShortPixel body key <code>url</code> before the global middleware runs.</p>
        </form>
      </section>
      ${resultMarkup}
      ${urlPanel}
    </main>
  </body>
</html>`;
}

function findUploadedFile(req, preferredField = "image") {
  const files = Array.isArray(req.files) ? req.files : [];

  if (preferredField) {
    const preferredFile = files.find((file) => file?.fieldname === preferredField);
    if (preferredFile) {
      return preferredFile;
    }
  }

  return files[0] || null;
}

function parseMultipartRequests(req, res, next) {
  if (!req.is?.("multipart/form-data")) {
    next();
    return;
  }

  upload.any()(req, res, next);
}

function captureOriginalUpload(req, res, next) {
  const file = findUploadedFile(req);

  if (!file?.buffer) {
    next();
    return;
  }

  req.originalUpload = {
    name: file.originalname,
    mimeType: file.mimetype || "application/octet-stream",
    size: file.buffer.length,
    buffer: Buffer.from(file.buffer)
  };

  next();
}

function mapSourceUrlToShortPixelField(req, res, next) {
  const sourceUrl = typeof req.body?.sourceUrl === "string" ? req.body.sourceUrl.trim() : "";

  if (sourceUrl) {
    req.body.url = sourceUrl;
  }

  next();
}

function requireApiKeyForOptimization(req, res, next) {
  if (shortPixelOptions.apiKey) {
    next();
    return;
  }

  if (req.method === "POST" && (req.path === "/upload" || req.path === "/url")) {
    next(new Error("Set SHORTPIXEL_API_KEY before uploading an image."));
    return;
  }

  next();
}

const shortPixelMiddleware = shortPixelOptions.apiKey
  ? ShortPixelExpress({
      ...shortPixelOptions,
      passthrough: true
    })
  : (req, res, next) => next();

app.use(parseMultipartRequests);
app.use(captureOriginalUpload);
app.use(mapSourceUrlToShortPixelField);
app.use(requireApiKeyForOptimization);
app.use(shortPixelMiddleware);

app.get("/", (req, res) => {
  res.type("html").send(renderPage());
});

app.post("/upload", (req, res) => {
  const file = findUploadedFile(req);

  if (!file?.buffer || !req.originalUpload?.buffer) {
    res.status(400).type("html").send(renderPage({
      error: "No file was uploaded or the file was skipped."
    }));
    return;
  }

  const optimizedMimeType = guessMimeType(
    file.mimetype,
    shortPixelOptions.convertto
  );

  res.type("html").send(renderPage({
    original: {
      name: req.originalUpload.name,
      mimeType: req.originalUpload.mimeType,
      size: req.originalUpload.size,
      dataUrl: toDataUrl(req.originalUpload.buffer, req.originalUpload.mimeType)
    },
    optimized: {
      name: file.originalname,
      mimeType: optimizedMimeType,
      size: file.buffer.length,
      dataUrl: toDataUrl(file.buffer, optimizedMimeType)
    }
  }));
});

app.post("/url", (req, res) => {
  const result = req.shortPixel?.urls?.[0];

  if (!result?.buffer) {
    res.status(400).type("html").send(renderPage({
      error: "No URL was optimized.",
      form: req.body
    }));
    return;
  }

  const optimizedMimeType = guessMimeType(
    null,
    shortPixelOptions.convertto || result.filename
  );

  res.type("html").send(renderPage({
    optimized: {
      sourceUrl: result.input,
      name: result.filename,
      mimeType: optimizedMimeType,
      size: result.buffer.length,
      dataUrl: toDataUrl(result.buffer, optimizedMimeType)
    },
    form: req.body
  }));
});

app.use((error, req, res, next) => {
  res.status(500).type("html").send(renderPage({
    error: error?.stack || error?.message || String(error),
    form: req?.body
  }));
});

app.listen(port, () => {
  console.log(`ShortPixel Express global demo listening on http://localhost:${port}`);
});
