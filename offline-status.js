/* Offline readiness indicator. Dependency-free; read-only: it never fetches, caches or registers anything for the feature.
   A placeholder <span class="gvt-offline" data-offline-assets="a, b"> is filled with one of four statuses:
   Ready offline / Download required / Online required / Checking offline availability.
   "Ready" needs an active service worker AND every listed asset present in Cache Storage (checked by key, not by navigator.onLine).
   Optional data-offline-manifest="path.json" data-offline-prefix="vendor/pdf/" adds every manifest file under the prefix (paths relative to the manifest).
   data-offline-download="hint" marks features whose missing assets the user can download; without it a gap is "Online required". */
(function () {
  "use strict";
  var LABEL = { checking: "Checking offline availability", ready: "Ready offline", download: "Download required", online: "Online required" };
  var base = (document.currentScript && document.currentScript.src) || location.href;
  try { var css = document.createElement("link"); css.rel = "stylesheet"; css.href = new URL("offline-status.css", base).href; document.head.appendChild(css); } catch (e) {}
  var running = false, again = false, retries = 0, retryTimer = 0, result = new Map();

  function norm(href) { var u = new URL(href, location.href); return u.origin + u.pathname; }
  function cacheKeys() {
    return caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) { return caches.open(n).then(function (c) { return c.keys(); }).catch(function () { return []; }); }));
    }).then(function (lists) { var set = new Set(); lists.forEach(function (l) { l.forEach(function (r) { set.add(norm(r.url)); }); }); return set; });
  }
  function expand(el, have) {
    var list = (el.getAttribute("data-offline-assets") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) { return norm(s); });
    var man = el.getAttribute("data-offline-manifest");
    if (!man) return Promise.resolve(list);
    var mu = norm(man);
    if (!have.has(mu)) return Promise.resolve(null); /* manifest itself unavailable offline: cannot confirm */
    return fetch(mu).then(function (r) { return r.ok ? r.json() : null; }).then(function (files) {
      if (!Array.isArray(files)) return null;
      var prefix = el.getAttribute("data-offline-prefix") || "";
      files.forEach(function (f) { if (f && typeof f.file === "string" && f.file.indexOf(prefix) === 0) list.push(norm(new URL(f.file, mu).href)); });
      return list.concat([mu]);
    }).catch(function () { return null; });
  }
  function docKey() { var p = location.pathname; return location.origin + (p.endsWith("/") ? p : p); }
  function evaluate(el, have, active) {
    if (!active) return Promise.resolve({ s: "online", d: "No offline worker is active yet. Visit the home page once while online." });
    return expand(el, have).then(function (list) {
      var dl = el.hasAttribute("data-offline-download");
      if (!list) return { s: dl ? "download" : "online", d: "The offline file list could not be confirmed." };
      var p = location.pathname, own = [docKey()]; if (p.endsWith("/")) own.push(location.origin + p + "index.html"); else own.push(location.origin + p + ".html", location.origin + p + "/index.html");
      var docOk = own.some(function (k) { return have.has(k); });
      var missing = list.filter(function (k) { return !have.has(k); }).length + (docOk ? 0 : 1);
      if (!missing) return { s: "ready", d: "All " + (list.length + 1) + " files this feature needs are saved on this device." };
      return { s: dl ? "download" : "online", d: missing + " of " + (list.length + 1) + " needed files are not saved on this device." + (dl ? " " + el.getAttribute("data-offline-download") : "") };
    });
  }
  function paint(el, s, d) {
    if (el.getAttribute("data-state") === s && el.getAttribute("data-detail") === d) return;
    el.setAttribute("data-state", s); el.setAttribute("data-detail", d);
    el.title = LABEL[s] + ". " + d;
    el.textContent = "";
    var t = document.createElement("span"); t.textContent = LABEL[s]; el.appendChild(t);
    var h = document.createElement("span"); h.className = "gvt-offline-sr"; h.textContent = ". " + d; el.appendChild(h);
  }
  function workerActive() {
    if (!("serviceWorker" in navigator) || !("caches" in window) || !window.isSecureContext) return Promise.resolve(false);
    return navigator.serviceWorker.getRegistration().then(function (r) { return !!(r && r.active); }, function () { return false; });
  }
  function check() {
    if (running) { again = true; return; }
    var els = Array.prototype.slice.call(document.querySelectorAll(".gvt-offline[data-offline-assets]"));
    if (!els.length) return;
    els.forEach(function (el) { if (!el.hasAttribute("data-state")) paint(el, "checking", "Looking at what is saved on this device."); });
    running = true;
    workerActive().then(function (active) {
      if (!("caches" in window)) return { active: false, have: new Set() };
      return cacheKeys().then(function (have) { return { active: active, have: have }; }, function () { return { active: false, have: new Set() }; });
    }).then(function (st) {
      return Promise.all(els.map(function (el) { return evaluate(el, st.have, st.active).then(function (r) { return [el, r]; }); }));
    }).then(function (rs) {
      /* Right after a first visit the worker and its runtime cache are still filling: stay in "checking" for a few retries instead of flashing a wrong answer. */
      var settling = rs.some(function (x) { return x[1].s !== "ready"; }) && retries < 3 && navigator.onLine !== false;
      rs.forEach(function (x) { if (settling && !result.has(x[0])) paint(x[0], "checking", "Looking at what is saved on this device."); else { result.set(x[0], 1); paint(x[0], x[1].s, x[1].d); } });
      if (settling) { retries++; clearTimeout(retryTimer); retryTimer = setTimeout(check, 1500 * retries); }
    }).catch(function () {
      els.forEach(function (el) { paint(el, "online", "Offline storage could not be read."); });
    }).then(function () { running = false; if (again) { again = false; check(); } });
  }
  function recheck() { retries = 3; check(); }
  window.GVTOffline = { refresh: function () { retries = 0; check(); }, check: recheck };
  addEventListener("load", check);
  if (document.readyState === "complete") check();
  addEventListener("online", recheck); addEventListener("offline", recheck); addEventListener("pageshow", recheck);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) recheck(); }); /* cache eviction while the tab was in the background */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", recheck);
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (!reg) return;
      reg.addEventListener("updatefound", function () { var w = reg.installing; if (w) w.addEventListener("statechange", function () { if (w.state === "activated") recheck(); }); });
    }).catch(function () {});
    navigator.serviceWorker.ready.then(function () { retries = 0; check(); }).catch(function () {});
  }
})();
