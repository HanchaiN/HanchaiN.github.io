import {
  extendCentroids,
  getSilhouetteScore,
  kMeans,
} from "@/scripts/utils/algo/kmeans.js";
import convert_color from "@/scripts/utils/color/conversion.js";
import type {
  ColorSpace,
  ColorSpaceMap,
} from "@/scripts/utils/color/conversion.js";
import { DistanceE94 } from "@/scripts/utils/color/distance.js";

const mode: ColorSpace = "lab";
type EmbedColor = ColorSpaceMap[typeof mode];
const srgb2embed = convert_color("srgb", mode)!,
  str2embed = convert_color("str", mode)!,
  embed2hex = convert_color(mode, "hex")!;
const color_distance = DistanceE94;
const copy = (a: EmbedColor) => a.slice() as EmbedColor;

export function extractPalette(
  buffer: ImageData,
  n_colors: number,
  reference: string[] = [],
) {
  const samples = new Array(buffer.width * buffer.height)
    .fill(0)
    .map((_, i) => {
      return srgb2embed([
        buffer.data[i * 4 + 0] / 255,
        buffer.data[i * 4 + 1] / 255,
        buffer.data[i * 4 + 2] / 255,
      ]);
    });
  return kMeans(
    samples,
    Infinity,
    n_colors,
    1000,
    reference.map(str2embed),
    copy,
    color_distance,
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

export function extendPalette(
  buffer: ImageData,
  n_colors: number,
  reference: string[],
) {
  const samples = new Array(buffer.width * buffer.height)
    .fill(0)
    .map((_, i) => {
      return srgb2embed([
        buffer.data[i * 4 + 0] / 255,
        buffer.data[i * 4 + 1] / 255,
        buffer.data[i * 4 + 2] / 255,
      ]);
    });
  return extendCentroids(
    samples,
    n_colors,
    reference.map(str2embed),
    color_distance,
    copy,
  ).map(embed2hex);
}

export function evaluatePalette(buffer: ImageData, palette: string[]) {
  const samples = new Array(buffer.width * buffer.height)
    .fill(0)
    .map((_, i) => {
      return srgb2embed([
        buffer.data[i * 4 + 0] / 255,
        buffer.data[i * 4 + 1] / 255,
        buffer.data[i * 4 + 2] / 255,
      ]);
    });
  return getSilhouetteScore(samples, palette.map(str2embed), color_distance);
}
