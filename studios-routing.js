/* Compatibility routing for consolidated studios; legacy tool IDs stay valid.
   Only IDs whose behaviour the studio fully covers are redirected. qr-studio, pii-secret-redactor and
   percentage-change keep opening their own richer tools (Wi-Fi/contact/scan QR, full redactor, standalone calculator). */
(function(){"use strict";
const routes={"url-cleaner":"url","url-inspector":"url","utm-builder":"url","tracking-check":"url","link-fingerprint":"url","hourly-rate":"freelance","qr-payload":"qr","metadata":"privacy"};
const original=window.openTool;
if(typeof original!=="function")return;
window.openTool=function(id){const studio=routes[id];if(studio){const u=new URL("studios.html",location.href);u.searchParams.set("studio",studio);u.searchParams.set("tool",id);location.assign(u.href);return;}return original.apply(this,arguments);};
})();