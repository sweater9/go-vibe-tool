/* Discovery adapter for the standalone PDF Editor. It only adds one catalogue entry (shown in the PDF & Tables category, next to
   Private PDF Tools) and sends its tile to the editor's own page. The editor is NOT embedded in Private PDF Tools or in this page. */
(function () {
  "use strict";
  if (typeof tools === "undefined" || typeof openTool !== "function") return;
  const entry = ["pdf-editor", "PDF & Tables", "PDF Editor", "Add text, images, shapes and highlights, then rotate, reorder and extract pages, privately in your browser."];
  if (tools.some((t) => t[0] === entry[0])) return;
  const at = tools.findIndex((t) => t[0] === "pdf-studio");
  tools.splice(at >= 0 ? at + 1 : tools.length, 0, entry);
  const previous = openTool;
  openTool = function (id) {
    if (id !== entry[0]) return previous(id);
    if (typeof rememberTool === "function") rememberTool(id);
    location.assign("tools/pdf-editor/");
  };
})();
