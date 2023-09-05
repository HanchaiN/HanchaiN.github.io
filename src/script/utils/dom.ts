import type {
  IKernelFunctionThis,
  IRenderFunctionThis,
} from "@/script/utils/types";
import * as d3 from "d3-color";

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

export function getColor(name: string, fallback = "#0000") {
  return d3.color(
    getComputedStyle(document.body).getPropertyValue(name) || fallback,
  )!;
}

export function getMousePos(canvas: HTMLCanvasElement, evt: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((evt.clientX - rect.left) / (rect.right - rect.left)) * canvas.width,
    y: ((evt.clientY - rect.top) / (rect.bottom - rect.top)) * canvas.height,
  };
}

export const maxWorkers = window.navigator.hardwareConcurrency
  ? Math.floor(window.navigator.hardwareConcurrency)
  : 1;

export function kernelGenerator<
  IConstants = Record<string, never>,
  IParameters extends any[] = [], // eslint-disable-line @typescript-eslint/no-explicit-any
  IReturnType = void,
>(
  main: (
    this: IKernelFunctionThis<IConstants>,
    ...args: IParameters
  ) => IReturnType,
  constants: IConstants,
  buffer: ImageData,
) {
  return function* (
    this: IRenderFunctionThis<IConstants>,
    ...args: Parameters<typeof main>
  ) {
    const res: IReturnType[][] = new Array(this.output.x)
      .fill(null)
      .map(() => new Array(this.output.y).fill(null));
    for (let y = 0; y < this.output.y; y++) {
      for (let x = 0; x < this.output.x; x++) {
        yield (res[x][y] = main.bind({
          output: this.output,
          thread: { x, y, z: 0 },
          constants: this.constants,
          color: (r: number, g: number = r, b: number = r, a: number = 1) =>
            this.color(x, y, r, g, b, a),
        })(...args));
      }
    }
    return res;
  }.bind({
    output: { x: buffer.width, y: buffer.height, z: 0 },
    constants: constants,
    color: (
      x: number,
      y: number,
      r: number,
      g: number = r,
      b: number = r,
      a: number = 1,
    ) => {
      buffer.data.set(
        [r * 255, g * 255, b * 255, a * 255],
        4 * buffer.width * (buffer.height - y - 1) + 4 * x,
      );
    },
  });
}
