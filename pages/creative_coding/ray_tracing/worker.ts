import type { TSpectrum } from "./spectrum.ts";
import { trace_screen } from "./utils.js";

export type MessageRequest = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
};
export type MessageResponse = null | {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  field: TSpectrum[][];
};

function main({ x0, x1, y0, y1, w, h }: MessageRequest): MessageResponse {
  return {
    x0,
    y0,
    x1,
    y1,
    field: new Array(x1 - x0)
      .fill(0)
      .map((_, x) =>
        new Array(y1 - y0)
          .fill(0)
          .map((_, y) => trace_screen(x + x0, y + y0, w, h).color),
      ),
  };
}

self?.addEventListener("message", ({ data }: MessageEvent<MessageRequest>) => {
  self.postMessage(main(data));
});
self?.postMessage(null); // indicate ready
