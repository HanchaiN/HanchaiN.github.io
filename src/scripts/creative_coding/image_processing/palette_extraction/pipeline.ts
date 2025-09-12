import {
  extendCentroids,
  getSilhouetteScore,
  kMeans,
} from "@/scripts/utils/algo/kmeans.js";
import convert_color from "@/scripts/utils/color/conversion.js";
import type {
  ColorSpace,
  ColorSpaceMap,
  SRGBColor,
} from "@/scripts/utils/color/conversion.ts";
import { DistanceE94 } from "@/scripts/utils/color/distance.js";

const embed: ColorSpace = "lab";
type EmbedColor = ColorSpaceMap[typeof embed];
const srgb2embed = convert_color("srgb", embed)!,
  str2embed = convert_color("str", embed)!,
  embed2hex = convert_color(embed, "hex")!;
const color_distance: (c1: EmbedColor, c2: EmbedColor) => number = DistanceE94;
const copy = (a: EmbedColor) => a.slice() as EmbedColor;

export function extractPalette(
  samples: SRGBColor[],
  n_colors: number,
  reference: string[] = [],
  { n_sample = Infinity, max_iter = 1000 } = {},
) {
  return kMeans(
    samples.map(srgb2embed),
    n_sample,
    n_colors,
    max_iter,
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
  samples: SRGBColor[],
  n_colors: number,
  reference: string[],
) {
  return extendCentroids(
    samples.map(srgb2embed),
    n_colors,
    reference.map(str2embed),
    color_distance,
    copy,
  ).map(embed2hex);
}

export function evaluatePalette(
  samples: SRGBColor[],
  palette: string[],
  { simplify_a = false, simplify_b = false } = {},
): number {
  return getSilhouetteScore(
    samples.map(srgb2embed),
    palette.map(str2embed),
    color_distance,
    simplify_a,
    simplify_b,
  );
}
