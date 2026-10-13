/* All regex compilation/execution is isolated; the UI terminates timed-out workers. */
try {
  importScripts("v8-developer-core.js");
} catch (error) {
  // Firefox can abort importScripts when a superseded worker is terminated.
  // Handle that lifecycle cancellation without an uncaught page error.
  if (/NS_BINDING_ABORTED/.test(error.name + " " + error.message)) close();
  else
    postMessage({
      ok: false,
      error: "Regex worker engine could not load: " + error.message,
    });
}
if (self.GVTDeveloper) {
  onmessage = (event) => {
    try {
      postMessage({
        ok: true,
        ...GVTDeveloper.regexMatches(
          event.data.pattern,
          event.data.text,
          event.data.flags,
        ),
      });
    } catch (error) {
      postMessage({ ok: false, error: error.message });
    }
  };
  postMessage({ ready: true });
}
