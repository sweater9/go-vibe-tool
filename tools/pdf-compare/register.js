/* Discovery adapter for the standalone PDF Compare tool: one catalogue entry in PDF & Tables, next to PDF Editor. The tool lives on its own page. */
(function () {
  "use strict";
  if (typeof tools === "undefined" || typeof openTool !== "function") return;
  const entry = ["pdf-compare", "PDF & Tables", "PDF Compare", "Compare two PDFs privately in your browser and see added, removed and changed text."];
  if (tools.some((t) => t[0] === entry[0])) return;
  const at = tools.findIndex((t) => t[0] === "pdf-editor");
  tools.splice(at >= 0 ? at + 1 : tools.length, 0, entry);
  const previous = openTool;
  openTool = function (id) {
    if (id !== entry[0]) return previous(id);
    if (typeof rememberTool === "function") rememberTool(id);
    location.assign("tools/pdf-compare/");
  };
})();
