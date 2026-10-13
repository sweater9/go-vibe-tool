/* Compatibility routing for consolidated studios; legacy tool IDs stay valid. */
(function(){"use strict";
const routes={"url-cleaner":"url","url-inspector":"url","utm-builder":"url","tracking-check":"url","link-fingerprint-inspector":"url","percentage-change":"freelance","effective-hourly-rate":"freelance","qr-payload":"qr","qr-studio":"qr","metadata":"privacy","pii-secret-redactor":"privacy"};
const original=window.openTool;
if(typeof original!=="function")return;
window.openTool=function(id){const studio=routes[id];if(studio){const u=new URL("studios.html",location.href);u.searchParams.set("studio",studio);u.searchParams.set("tool",id);location.assign(u.href);return;}return original.apply(this,arguments);};
})();