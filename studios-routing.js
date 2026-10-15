/* Existing IDs stay in the catalogue, storage and deep links; they open consolidated workspaces in-place. */
(function () {
  "use strict";
  const c = window.GVTStudios;
  if (!c || !window.GVTStudioUI || typeof openTool !== "function") return;
  const previousOpen = openTool,
    previousClose = closeTool;
  closeTool = function () {
    const studio = document.getElementById("studioRoot");
    if (studio) {
      GVTStudioUI.dispose();
      const u = new URL(location.href);
      u.searchParams.delete("tool");
      u.searchParams.delete("studio");
      history.replaceState(history.state, "", u);
    }
    const result = previousClose();
    if (studio) studio.remove();
    return result;
  };
  // Retire the Freelance Studio entries without changing other tool IDs or categories.
  const retired = new Set(["hourly-rate", "effective-hourly-rate"]);
  for (let i = tools.length - 1; i >= 0; i--) {
    if (retired.has(tools[i][0])) tools.splice(i, 1);
  }
  for (const t of tools) {
    const tab = c.aliases[t[0]];
    if (tab)
      t[3] +=
        " Consolidated " +
        c.titles[tab] +
        " workspace. " +
        {
          url: "Inspect clean URLs, audit trackers and build UTM campaign links.",
          qr: "Validate payloads, generate and decode QR text, URLs, Wi-Fi and contacts.",
          privacy:
            "Audit sensitive text, detect and redact metadata, tokens, credentials, IPs and connection strings.",
        }[tab];
  }
  openTool = function (id) {
    if (retired.has(id)) {
      if (document.getElementById("studioRoot")) closeTool();
      return previousOpen.call(this, id);
    }
    if (!c.aliases[id]) {
      if (document.getElementById("studioRoot")) closeTool();
      return previousOpen.apply(this, arguments);
    }
    const workspace = document.getElementById("workspace");
    if (!workspace?.classList.contains("active") || !workspace.querySelector("#studioRoot"))
      closeTool();
    rememberTool(id);
    const w = GVTStudioUI.mount(id);
    w.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };
})();
