function pickBestOutputUrl(meta, opts = {}) {
  // If user requested conversion, try AVIF/WebP first, but fall back to PNG/JPG always.
  const convertto = typeof opts.convertto === "string" ? opts.convertto : "";
  const lossy = Number(opts.lossy ?? 1);

  const wantsAvif = convertto.includes("avif");
  const wantsWebp = convertto.includes("webp");

  const pick = (lossyUrl, losslessUrl) => {
    if (lossy > 0 && lossyUrl && lossyUrl !== "NA") return lossyUrl;
    if (losslessUrl && losslessUrl !== "NA") return losslessUrl;
    return null;
  };

  if (wantsAvif) {
    const url = pick(meta.AVIFLossyURL, meta.AVIFLosslessURL);
    if (url) return url;
  }
  if (wantsWebp) {
    const url = pick(meta.WebPLossyURL, meta.WebPLosslessURL);
    if (url) return url;
  }

  // Default: keep original format optimized
  return pick(meta.LossyURL, meta.LosslessURL);
}

export { pickBestOutputUrl };
