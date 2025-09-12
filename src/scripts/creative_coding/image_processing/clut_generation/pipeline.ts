// https://github.com/ozwaldorf/lutgen-rs
import type {
  ColorSpace,
  ColorSpaceMap,
  SRGBColor,
} from "@/scripts/utils/color/conversion.js";
import convert_color from "@/scripts/utils/color/conversion.js";
import { DistanceE94 } from "@/scripts/utils/color/distance.js";
import { kernelRunner } from "@/scripts/utils/dom/kernelGenerator.js";
import type { IKernelFunctionThis } from "@/scripts/utils/dom/kernelGenerator.ts";
import { sample } from "@/scripts/utils/math/random.js";
import { normalize, softargmax } from "@/scripts/utils/math/utils.js";
import { vector_add, vector_mult } from "@/scripts/utils/math/vector.js";

import type { IKernelFunctionThis_CMap } from "../color_grading/pipeline.js";

const embed: ColorSpace = "lab";
type EmbedColor = ColorSpaceMap[typeof embed];
const srgb2embed = convert_color("srgb", embed)!,
  embed2srgb = convert_color(embed, "srgb")!;
const color_distance: (c1: EmbedColor, c2: EmbedColor) => number = DistanceE94;

export function detectLevel(width: number, height: number) {
  if (width !== height) {
    throw new Error("CLUT must be square");
  }
  if (!Number.isInteger(Math.cbrt(width))) {
    throw new Error("CLUT must be perfect cube");
  }
  return Math.cbrt(width);
}

function _getBaseLUT(this: IKernelFunctionThis<{ level: number }>) {
  const level = this.constants.level;
  const cube_size = level * level;
  const image_size = cube_size * level;

  const index = image_size * (image_size - this.thread.y - 1) + this.thread.x;
  const ir = index % cube_size;
  const ig = Math.floor(index / cube_size) % cube_size;
  const ib = Math.floor(index / (cube_size * cube_size)) % cube_size;

  this.color(
    ir / (cube_size - 1),
    ig / (cube_size - 1),
    ib / (cube_size - 1),
    1,
  );
}

export function getBaseLUT(lut: ImageData) {
  const level = detectLevel(lut.width, lut.height);
  const runner = kernelRunner(_getBaseLUT, { level }, lut);
  return runner();
}

export function _applyClosest(
  this: IKernelFunctionThis_CMap<{
    color_palette: SRGBColor[];
    embed_palette: EmbedColor[];
  }>,
) {
  const { color_palette, embed_palette } = this.constants;
  const [r, g, b, a] = this.getColor();

  const target_color = srgb2embed([r, g, b]);
  const current_color = sample(
    color_palette,
    softargmax(
      embed_palette.map((c) => -color_distance(target_color, c)),
      0,
    ),
  );
  this.color(...current_color, a);
}

export function applyClosest(img: ImageData, palette: SRGBColor[]) {
  const embed_palette = palette.map(srgb2embed);
  const runner = kernelRunner(
    _applyClosest,
    { color_palette: palette, embed_palette },
    img,
  );
  return runner();
}

export function _applyRBF(
  this: IKernelFunctionThis_CMap<{
    embed_palette: EmbedColor[];
    rbf: (distance: number) => number;
    color_count: number;
  }>,
) {
  const { embed_palette, rbf } = this.constants;
  const color_count =
    0 < this.constants.color_count &&
    this.constants.color_count < embed_palette.length
      ? this.constants.color_count
      : embed_palette.length;
  const [r, g, b, a] = this.getColor();

  const target_color = srgb2embed([r, g, b]);

  const acc = normalize(
    embed_palette.map((c) => rbf(color_distance(target_color, c))),
  )
    .map((w, i) => [embed_palette[i], w] as [EmbedColor, number])
    .sort(([, w1], [, w2]) => w2 - w1)
    .filter(([, w], i, arr) => w >= arr[color_count - 1][1])
    .reduce(
      ([c_, w_], [c, w]) =>
        [vector_add(c_, vector_mult(c, w)), w_ + w] as [EmbedColor, number],
      [[0, 0, 0], 0],
    );
  const current_color = embed2srgb(acc[0].map((v) => v / acc[1]) as EmbedColor);
  this.color(...current_color, a);
}

export function applyGaussianRBF(
  img: ImageData,
  palette: SRGBColor[],
  temperature: number = 1,
  color_count: number = 0,
) {
  const embed_palette = palette.map(srgb2embed);
  const runner = kernelRunner(
    _applyRBF,
    {
      embed_palette,
      color_count,
      rbf: (distance) => Math.exp(-Math.pow(distance, 2) / temperature),
    },
    img,
  );
  return runner();
}

export function applyInverseRBF(
  img: ImageData,
  palette: SRGBColor[],
  color_count: number = 0,
) {
  const embed_palette = palette.map(srgb2embed);
  const runner = kernelRunner(
    _applyRBF,
    {
      embed_palette,
      color_count,
      rbf: (distance) => 1 / distance,
    },
    img,
  );
  return runner();
}

export function applyCustomRBF(
  img: ImageData,
  palette: SRGBColor[],
  color_count: number = 0,
  rbf: (distance: number) => number,
) {
  const embed_palette = palette.map(srgb2embed);
  const runner = kernelRunner(
    _applyRBF,
    {
      embed_palette,
      color_count,
      rbf,
    },
    img,
  );
  return runner();
}

export function _applySibson(
  this: IKernelFunctionThis_CMap<{
    embed_palette: EmbedColor[];
    color_count: number;
  }>,
) {
  throw new Error("Not implemented");
}

export function applySibson(
  img: ImageData,
  palette: SRGBColor[],
  color_count: number = 0,
) {
  const embed_palette = palette.map(srgb2embed);
  const runner = kernelRunner(
    _applySibson,
    { embed_palette, color_count },
    img,
  );
  return runner();
}

export function _applyMap<EmbedColor extends ColorSpaceMap[ColorSpace]>(
  this: IKernelFunctionThis_CMap<{
    srgb2embed: (color: SRGBColor) => EmbedColor;
    embed2srgb: (color: EmbedColor) => SRGBColor;
    mapper: (color: EmbedColor) => EmbedColor;
  }>,
) {
  const { srgb2embed, embed2srgb, mapper } = this.constants;
  const [r, g, b, a] = this.getColor();
  const [r_, g_, b_] = embed2srgb(mapper(srgb2embed([r, g, b])));
  this.color(r_, g_, b_, a);
}

export function applyCustomMap(
  img: ImageData,
  embed: ColorSpace,
  mapper: (color: ColorSpaceMap[typeof embed]) => ColorSpaceMap[typeof embed],
) {
  const srgb2embed = convert_color("srgb", embed)!,
    embed2srgb = convert_color(embed, "srgb")!;
  const runner = kernelRunner(
    _applyMap,
    { mapper, srgb2embed, embed2srgb },
    img,
  );
  return runner();
}
