import convert_color from "../color/conversion.js";

const str2hex = convert_color("str", "hex")!;

export function getParentSize(parent: HTMLElement, canvas: HTMLElement) {
  if (canvas) canvas.hidden = true;
  const rect = parent?.getBoundingClientRect();
  const width = Math.floor(
    rect?.width ||
      window.innerWidth ||
      document.documentElement.clientWidth ||
      document.body.clientWidth,
  );
  const height = Math.floor(
    rect?.height ||
      window.innerHeight ||
      document.documentElement.clientHeight ||
      document.body.clientHeight,
  );
  if (canvas) canvas.hidden = false;
  return { width, height };
}

export function getCssVarColor(name: string, fallback = "#0000") {
  return str2hex(
    getComputedStyle(document.body).getPropertyValue(name) || fallback,
  );
}

export function getMousePos(canvas: HTMLCanvasElement, evt: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((evt.clientX - rect.left) / (rect.right - rect.left)) * canvas.width,
    y: ((evt.clientY - rect.top) / (rect.bottom - rect.top)) * canvas.height,
  };
}

export const maxWorkers = window?.navigator?.hardwareConcurrency
  ? Math.floor(window.navigator.hardwareConcurrency)
  : 1;

export function startLoop(
  callback: (t: DOMHighResTimeStamp) => Promise<boolean> | boolean,
) {
  const t: DOMHighResTimeStamp = performance.now();
  requestIdleCallback(
    async () => {
      if (await callback(t)) startLoop(callback);
    },
    { timeout: 1 },
  );
}

export function startAnimationLoop(
  callback: (t: DOMHighResTimeStamp) => Promise<boolean> | boolean,
) {
  requestAnimationFrame(async function loop(t: DOMHighResTimeStamp) {
    if (await callback(t)) requestAnimationFrame(loop);
  });
}
