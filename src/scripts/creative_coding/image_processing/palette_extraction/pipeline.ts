import { vector_dist } from "@/scripts/utils/math/vector.js";
import { kMeans } from "@/scripts/utils/algo/kmeans.js";
import convert_color from "@/scripts/utils/color/conversion.js";
import type { ColorSpace } from "@/scripts/utils/color/conversion.js";

const mode: ColorSpace = "xyz";
const srgb2embed = convert_color("srgb", mode)!,
  embed2hex = convert_color(mode, "hex")!;

export function getPalette(buffer: ImageData, n_colors: number) {
  return kMeans(
    new Array(buffer.width * buffer.height).fill(0).map((_, i) => {
      return srgb2embed([
        buffer.data[i * 4 + 0] / 255,
        buffer.data[i * 4 + 1] / 255,
        buffer.data[i * 4 + 2] / 255,
      ]);
    }),
    Infinity,
    n_colors,
    1000,
    [],
    (v) => [v[0], v[1], v[2]] as [number, number, number],
    (a, b) => vector_dist(a, b),
    (a, w) => {
      const v = [0, 0, 0, 0];
      a.forEach((_, i) => {
        v[0] += a[i][0] * w[i];
        v[1] += a[i][1] * w[i];
        v[2] += a[i][2] * w[i];
        v[3] += w[i];
      });
      return [v[0] / v[3], v[1] / v[3], v[2] / v[3]] as [
        number,
        number,
        number,
      ];
    },
  ).map((c) => embed2hex(c));
}
