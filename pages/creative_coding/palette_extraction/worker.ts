import type { SRGBColor } from "@/utils/color/conversion.js";
import { extractPalette } from "./pipeline.js";

export type MessageRequest = {
  samples: SRGBColor[];
  n_colors: number;
  reference: string[];
  options: {
    n_sample?: number;
    max_iter?: number;
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

self?.addEventListener("message", ({ data }: MessageEvent<MessageRequest>) =>
  data !== null ? self.postMessage(main(data)) : null,
);
self?.postMessage(null); // indicate ready
