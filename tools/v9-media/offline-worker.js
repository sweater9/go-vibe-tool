/* Scope is only /tools/v9-media/. Cache assets, never user files or blob results. */
const CACHE = "gvt-v9-media-1";
const APP = [
  "./",
  "index.html",
  "media.css",
  "media.js",
  "media-core.js",
  "../../v9-utilities-core.js",
  "../../vendor/pdf-lib.min.js",
  "../../assets/icon.svg",
  "vendor-assets.json",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const response = await fetch("vendor-assets.json", { cache: "reload" });
      if (!response.ok) throw Error("Missing asset manifest");
      const files = await response.json(),
        cache = await caches.open(CACHE),
        queue = [...APP, ...files.map((f) => f.file)];
      // Hash verification supplements HTTPS for the pinned, vendored engines and model.
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (queue.length) {
            const file = queue.shift(),
              r = await fetch(file, { cache: "reload" });
            if (!r.ok) throw Error("Missing offline asset: " + file);
            const pin = files.find((f) => f.file === file);
            if (pin) {
              const digest = await crypto.subtle.digest(
                "SHA-256",
                await r.clone().arrayBuffer(),
              );
              const hash = Array.from(new Uint8Array(digest), (v) =>
                v.toString(16).padStart(2, "0"),
              ).join("");
              if (hash !== pin.sha256)
                throw Error("Asset integrity mismatch: " + file);
            }
            await cache.put(file, r);
          }
        }),
      );
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("gvt-v9-media-") && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const u = new URL(event.request.url);
  if (event.request.method !== "GET" || u.origin !== location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE),
        key =
          event.request.mode === "navigate"
            ? new URL("./", location.href)
            : event.request;
      const hit = await cache.match(key);
      return hit || fetch(event.request);
    })(),
  );
});
