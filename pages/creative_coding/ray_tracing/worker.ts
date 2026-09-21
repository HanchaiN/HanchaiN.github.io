import { initTaskWorker } from "@/utils/dom/worker/init_worker.js";
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
export type MessageResponse = {
  param: MessageRequest;
  field: TSpectrum[][];
};

export function main(param: MessageRequest): MessageResponse {
  const { x0, y0, x1, y1, w, h } = param;
  return {
    param,
    field: new Array(x1 - x0)
      .fill(0)
      .map((_, x) =>
        new Array(y1 - y0)
          .fill(0)
          .map((_, y) => trace_screen(x + x0, y + y0, w, h).color),
      ),
  };
}

initTaskWorker(main, true);
