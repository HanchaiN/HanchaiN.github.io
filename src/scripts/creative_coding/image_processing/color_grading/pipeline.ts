import convert_color from "@/scripts/utils/color/conversion.js";
import type { SRGBColor, XYZColor } from "@/scripts/utils/color/conversion.ts";
import { kernelRunner } from "@/scripts/utils/dom/kernelGenerator.js";
import type { IKernelFunctionThis } from "@/scripts/utils/dom/kernelGenerator.ts";
import { softargmax } from "@/scripts/utils/math/utils.js";
import {
  vector_add,
  vector_mag,
  vector_mult,
  vector_sub,
} from "@/scripts/utils/math/vector.js";
import type { ExcludeKeys } from "@/scripts/utils/types.ts";

import { detectLevel, getBaseLUT } from "../clut_generation/pipeline.js";

const srgb2xyz = convert_color("srgb", "xyz")!;
const xyz2srgb = convert_color("xyz", "srgb")!;

function _mapColor(c: [number, number, number], lut: ImageData, level: number) {
  const cube_size = level * level;
  const [r, g, b] = [
    Math.round(c[0] * (cube_size - 1)),
    Math.round(c[1] * (cube_size - 1)),
    Math.round(c[2] * (cube_size - 1)),
  ];
  const x = (r % cube_size) + (g % level) * cube_size;
  const y = b * level + Math.floor(g / level);
  const index = (y * lut.width + x) * 4;

  return [
    lut.data[index + 0] / 255,
    lut.data[index + 1] / 255,
    lut.data[index + 2] / 255,
  ] as SRGBColor;
}

export function mapColor(
  c: SRGBColor,
  lut: ImageData,
  temperature: number = 1,
) {
  if (lut.colorSpace !== "srgb") {
    console.warn("CLUT should be in sRGB color space");
  }
  const level = detectLevel(lut.width, lut.height);
  const cube_size = level * level;
  const [r0, g0, b0] = [
    c[0] * (cube_size - 1),
    c[1] * (cube_size - 1),
    c[2] * (cube_size - 1),
  ];
  const xyz0 = srgb2xyz(c);
  const ref: [SRGBColor, number][] = [];
  for (const ir of [0, 1]) {
    const r1 = Math.floor(r0) + ir;
    if (r1 < 0 || r1 >= cube_size) continue;
    for (const ig of [0, 1]) {
      const g1 = Math.floor(g0) + ig;
      if (g1 < 0 || g1 >= cube_size) continue;
      for (const ib of [0, 1]) {
        const b1 = Math.floor(b0) + ib;
        if (b1 < 0 || b1 >= cube_size) continue;
        const c1: SRGBColor = [
          r1 / (cube_size - 1),
          g1 / (cube_size - 1),
          b1 / (cube_size - 1),
        ];
        const d = vector_mag(vector_sub(xyz0, srgb2xyz(c1)));
        const c_ = _mapColor(c1, lut, level);
        ref.push([c_, d]);
      }
    }
  }
  const acc = softargmax(
    ref.map((a) => -a[1]),
    temperature,
  )
    .map((w, i) => [srgb2xyz(ref[i][0]), w] as [XYZColor, number])
    .reduce(
      ([c_, w_], [c, w]) =>
        [vector_add(c_, vector_mult(c, w)), w_ + w] as [XYZColor, number],
      [[0, 0, 0], 0],
    );
  return xyz2srgb(acc[0].map((v) => v / acc[1]) as XYZColor);
}

export function _applyGrading(
  this: IKernelFunctionThis_CMap<{
    lut: ImageData;
  }>,
) {
  const [r, g, b, a] = this.getColor();
  const color = mapColor([r, g, b], this.constants.lut);
  this.color(color[0], color[1], color[2], a);
}

export function applyGrading(img: ImageData, lut: ImageData) {
  const runner = kernelRunner(
    _applyGrading,
    {
      lut,
    },
    img,
  );
  return runner();
}

export type IKernelFunctionThis_CMap<IConstants> = ExcludeKeys<
  IKernelFunctionThis<IConstants>,
  "output" | "thread"
>;

export function getColorMapper<
  IConstants = Record<string, never>,
  IParameters extends any[] = [], // eslint-disable-line @typescript-eslint/no-explicit-any
>(
  img: ImageData,
  mapper: (
    this: IKernelFunctionThis_CMap<IConstants>,
    ...args: IParameters
  ) => void,
  constants: IConstants,
  level: number = 16,
) {
  if (img.width * img.height < Math.pow(level, 6)) {
    const runner = kernelRunner(mapper, constants, img);
    return function (...args: IParameters) {
      return runner(...args);
    };
  } else {
    const image_size = Math.pow(level, 3);
    const lut = new ImageData(image_size, image_size);
    const runner = kernelRunner(mapper, constants, lut);
    return function (...args: IParameters) {
      getBaseLUT(lut);
      runner(...args);
      return applyGrading(img, lut);
    };
  }
}

export function applyColorMapping<
  IConstants = Record<string, never>,
  IParameters extends any[] = [], // eslint-disable-line @typescript-eslint/no-explicit-any
>(
  img: ImageData,
  mapper: (
    this: IKernelFunctionThis_CMap<IConstants>,
    ...args: IParameters
  ) => void,
  constants: IConstants,
  level: number = 16,
  ...args: IParameters
) {
  const colorMapper = getColorMapper(img, mapper, constants, level);
  return colorMapper(...args);
}
