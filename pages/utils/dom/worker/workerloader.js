// Source - https://stackoverflow.com/a/75801817
// Posted by hsc
// Retrieved 2026-09-20, License - CC BY-SA 4.0

import "https://ga.jspm.io/npm:es-module-shims@1.6.2/dist/es-module-shims.wasm.js";

self?.addEventListener("message", function listener(event) {
  const trustedOrigins = ["", self?.location?.origin];
  if (
    !event ||
    trustedOrigins.every((trustedOrigin) => event.origin === trustedOrigin)
  ) {
    return;
  }

  const {
    data: { importMap, workerUrl },
  } = event;
  this.removeEventListener("message", listener);

  importShim.addImportMap(JSON.parse(importMap));
  importShim(workerUrl)
    .then((_) => {
      self?.postMessage("module has been loaded");
    })
    .catch((e) =>
      setTimeout(() => {
        throw e;
      }),
    );
});
