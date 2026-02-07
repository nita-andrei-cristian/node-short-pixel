const defaultConfig = {
  key: "",
  plugin_version: "NP001",
  proxy: null,
  timeout: 30000,
  retries: 2,
  retryDelay: 800,
  wait: 20,
  // Optional default output format for reducer/postReducer calls (e.g. "webp" or "avif").
  // If left null, the original format is kept unless per-call options provide `convertto`.
  convertto: null,
  poll: {
    enabled: true,
    interval: 1500,
    maxAttempts: 12
  }
};

// Ensure a single shared config object across all component imports (even if bundled twice)
export const config =
  globalThis.__shortpixel_config || (globalThis.__shortpixel_config = defaultConfig);
