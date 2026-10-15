/* Isolated V9 registry adapter. Existing category definitions remain authoritative. */
(function () {
  "use strict";
  const entries = [
    [
      "cubic-bezier",
      "Images & Design",
      "Cubic-Bezier Easing Curve",
      "Edit and preview a CSS timing curve locally.",
    ],
    [
      "screenshot-beautifier",
      "Images & Design",
      "Screenshot Beautifier & 3D Mockup",
      "Frame screenshots and export a local PNG with perspective.",
    ],
    [
      "pdf-signer",
      "PDF & Tables",
      "PDF Signer & Document Flattener",
      "Add a visible signature and raster-flatten PDFs locally. Not a cryptographic signature.",
    ],
    [
      "offline-ocr",
      "Writing & Text",
      "Offline Image-to-Text OCR",
      "Recognize English image text on your device.",
    ],
    [
      "silence-stripper",
      "Images & Design",
      "Silence Stripper & Audio Leveler",
      "Remove quiet passages and level audio to WAV locally.",
    ],
    [
      "video-gif-trimmer",
      "Images & Design",
      "Watermark-Free Video/GIF Trimmer",
      "Trim GIFs or supported videos locally with no added watermark.",
    ],
  ];
  tools.push(...entries);
  const previous = openTool,
    close = closeTool;
  closeTool = function () {
    document.querySelector("#v9MediaFrame")?.remove();
    return close();
  };
  openTool = function (id) {
    const entry = entries.find((t) => t[0] === id);
    if (!entry) return previous(id);
    closeTool();
    const w = document.querySelector("#workspace");
    w.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = entry[2];
    const button = document.createElement("button");
    button.className = "btn";
    button.textContent = "Close";
    button.onclick = () => closeTool();
    const frame = document.createElement("iframe");
    frame.id = "v9MediaFrame";
    frame.title = entry[2];
    frame.src = "tools/v9-media/?tool=" + encodeURIComponent(id);
    frame.width = "100%";
    frame.height = "1100";
    frame.setAttribute("style", "border:0;display:block;max-width:100%");
    w.append(heading, button, frame);
    w.classList.add("active");
    if (typeof rememberTool === "function") rememberTool(id);
    w.focus({ preventScroll: true });
  };
})();
