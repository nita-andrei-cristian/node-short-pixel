import express from "express";
import multer from "multer";
import { ShortPixelExpress } from "../main.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send(`
    <html>
      <body style="font-family:sans-serif;padding:40px">
        <h2>ShortPixel Image Optimizer</h2>

        <form action="/upload" method="POST" enctype="multipart/form-data">
          <input type="file" name="image" accept="image/*" required/>
          <br><br>
          <button type="submit">Upload & Optimize</button>
        </form>
      </body>
    </html>
  `);
});

app.post(
  "/upload",
  upload.single("image"),
  (req, res, next) => {
    req.originalSize = req.file.buffer.length;
    next();
  },
  ShortPixelExpress({
    apiKey: process.env.SHORTPIXEL_API_KEY,
    lossy: 1,
    convertto: "+webp"
  }),
  (req, res) => {
    const result = req.shortPixel?.files?.[0];

    const optimizedSize = result.buffer.length;
    const originalSize = req.originalSize;

    const percent = (
      (1 - optimizedSize / originalSize) *
      100
    ).toFixed(2);

    const base64 = result.buffer.toString("base64");

    res.send(`
      <html>
        <body style="font-family:sans-serif;padding:40px">

          <h2>Optimization Result</h2>

          <p><b>Original size:</b> ${(originalSize / 1024).toFixed(2)} KB</p>
          <p><b>Optimized size:</b> ${(optimizedSize / 1024).toFixed(2)} KB</p>
          <p><b>Saved:</b> ${percent}%</p>

          <br>

          <h3>Optimized Image</h3>
          <img src="data:image/webp;base64,${base64}" style="max-width:400px"/>

          <br><br>

          <a download="${result.filename}" href="data:image/webp;base64,${base64}">
            Download optimized image
          </a>

          <br><br>
          <a href="/">Upload another</a>

        </body>
      </html>
    `);
  }
);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
