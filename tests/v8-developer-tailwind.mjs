/* Compile generated classes against the actual pinned Tailwind 3.4 compiler. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  core = require("../v8-developer-core.js");
const tw = require(process.env.TAILWIND_PACKAGE || "tailwindcss");
const postcss = require(process.env.POSTCSS_PACKAGE || "postcss");
const css =
  "font-family: My_font, sans-serif; font-size: 19px; color: rgb(12 34 56 / 0.5); border-width: 3px; width: calc(100% - 1rem);";
const layer = {
    x: 0,
    y: 12,
    blur: 30,
    spread: -6,
    color: "#0f172a",
    opacity: 0.22,
    inset: false,
  },
  glass = {
    enabled: true,
    color: "#ffffff",
    opacity: 0.2,
    blur: 16,
    saturation: 140,
    border: 1,
    borderOpacity: 0.4,
  };
const classes =
  core.cssToTailwind(css).output +
  " " +
  core.shadowCss([layer], glass).tailwind;
const result = await postcss([
  tw({ content: [{ raw: classes }], corePlugins: { preflight: false } }),
]).process("@tailwind utilities;", { from: undefined });
const generated = [];
result.root.walkDecls((d) => generated.push([d.prop, d.value]));
for (const [prop, value] of [
  ["font-family", "My_font, sans-serif"],
  ["font-size", "19px"],
  ["color", "rgb(12 34 56 / 0.5)"],
  ["border-width", "3px"],
  ["width", "calc(100% - 1rem)"],
  ["backdrop-filter", "blur(16px) saturate(140%)"],
  ["-webkit-backdrop-filter", "blur(16px) saturate(140%)"],
  ["border", "1px solid rgba(255, 255, 255, 0.4)"],
])
  assert.ok(
    generated.some(([p, v]) => p === prop && v === value),
    "compiler output " + prop,
  );
assert.ok(
  generated.some(
    ([p, v]) => p === "--tw-shadow" && v.includes("0px 12px 30px -6px"),
  ),
);
assert.equal(result.warnings().length, 0);
console.log(
  "Tailwind 3.4 compiler: generated arbitrary values compile to expected CSS.",
);
