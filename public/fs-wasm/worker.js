// Web Worker hosting the real FrankenSim numerical kernels (fs-wasm).
// Everything here runs the actual compiled Rust — fs-sparse / fs-cheb / fs-rand /
// fs-math / fs-ivl / fs-ad / fs-fft / fs-la — off the main thread. Results
// (Float64Array) are transferred zero-copy. `import * as` auto-exposes every
// export so new kernels need no worker change.

import init, * as mod from "./fs_wasm.js";

const ready = init().then(() => (typeof mod.engine === "function" ? mod.engine() : "fs-wasm"));
// Broadcast readiness. The `.catch` is required: if wasm init rejects, this
// chain would otherwise be an unhandled promise rejection. Per-message calls
// still surface the failure via `await ready` in onmessage below; the main
// thread safely ignores this diagnostic message type.
ready
  .then((e) => self.postMessage({ type: "ready", engine: e }))
  .catch((e) => self.postMessage({ type: "init-error", error: String(e && e.message ? e.message : e) }));

self.onmessage = async (ev) => {
  const { id, fn, args } = ev.data || {};
  try {
    await ready;
    const f = mod[fn];
    if (typeof f !== "function") throw new Error("unknown fn: " + fn);
    const t0 = performance.now();
    const result = f(...(args || []));
    const ms = performance.now() - t0;
    if (result instanceof Float64Array) {
      self.postMessage({ id, ok: true, result, ms }, [result.buffer]);
    } else {
      self.postMessage({ id, ok: true, result, ms });
    }
  } catch (e) {
    self.postMessage({ id, ok: false, error: String(e && e.message ? e.message : e) });
  }
};
