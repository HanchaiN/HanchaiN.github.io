import type { SRGBColor } from "@/utils/color/conversion.js";
import { extractPalette } from "./pipeline.js";
import { initTaskWorker } from "@/utils/dom/worker/init_worker.js";

export type MessageRequest = {
  samples: SRGBColor[];
  n_colors: number;
  reference: string[];
  options: {
    n_sample?: number;
    max_iter?: number;
    mode?: "kmean" | "gmm";
  };
};
export type MessageResponse = {
  centroids: string[];
};

export function main({
  samples,
  n_colors,
  reference,
  options,
}: MessageRequest) {
  const response: MessageResponse = {
    centroids: extractPalette(samples, n_colors, reference, options),
  };
  return response;
}

initTaskWorker(main, true);
