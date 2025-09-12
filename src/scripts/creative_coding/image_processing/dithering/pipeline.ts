import convert_color from "@/scripts/utils/color/conversion.js";
import type {
  ColorSpace,
  ColorSpaceMap,
  SRGBColor,
  XYZColor,
} from "@/scripts/utils/color/conversion.ts";
import { DistanceE94 } from "@/scripts/utils/color/distance.js";
import { kernelRunner } from "@/scripts/utils/dom/kernelGenerator.js";
import type { IKernelFunctionThis } from "@/scripts/utils/dom/kernelGenerator.ts";
import { sample } from "@/scripts/utils/math/random.js";
import { softargmax } from "@/scripts/utils/math/utils.js";
import {
  vector_add,
  vector_dot,
  vector_mult,
  vector_sub,
} from "@/scripts/utils/math/vector.js";

const embed: ColorSpace = "lab";
type EmbedColor = ColorSpaceMap[typeof embed];
const srgb2embed = convert_color("srgb", embed)!,
  embed2lab = convert_color(embed, "lab")!;
const color_distance = (a: EmbedColor, b: EmbedColor) =>
  DistanceE94(embed2lab(a), embed2lab(b));

function validate_map(map: number[][]) {
  if (map.length === 0) throw new Error("map must be non-empty");
  if (map.length !== map[0].length) throw new Error("map must be square");
  const n = map.length;
  const flat = map.flat();
  for (let i = 0; i < n * n; i++) {
    if (flat.indexOf(i) === -1) throw new Error("map must be permutation");
  }
  return n;
}

function normalize_map(map: number[][]) {
  const n = validate_map(map);
  return map.map((row) =>
    row.map((v) => v / (n * n) - (0.5 * (n * n - 1)) / (n * n)),
  );
}

function _threshold_map(
  n: number,
  x: number,
  y: number,
  base: number[][],
): number {
  if (n === 1) return 0;
  if (n % base.length !== 0) {
    throw new Error(
      `n must be power of base.length, but got ${n} % ${base.length}`,
    );
  }
  const partition_size = n / base.length;
  return (
    Math.pow(base.length, 2) *
      _threshold_map(
        partition_size,
        x % partition_size,
        y % partition_size,
        base,
      ) +
    base[Math.floor(x / partition_size)][Math.floor(y / partition_size)]
  );
}

function threshold_map(n: number, base: number[][]): number[][] {
  validate_map(base);
  return new Array(n)
    .fill(0)
    .map((_, i) =>
      new Array(n).fill(0).map((_, j) => _threshold_map(n, i, j, base)),
    );
}

function _applyDithering_Ordered(
  this: IKernelFunctionThis<{
    cmap: number[][];
    color_palette: SRGBColor[];
    embed_palette: XYZColor[];
    embed_avg: [number, number, XYZColor][];
    temperature: number;
  }>,
) {
  const n = this.constants.cmap.length;
  const { x, y } = this.thread;
  const seed = this.constants.cmap[x % n][y % n] + 0.5;
  const [r, g, b, a] = this.getColor();
  const target_color = srgb2embed([r, g, b]);
  const pair_index = sample(
    this.constants.embed_avg.map(([i, j]) => [i, j] as [number, number]),
    softargmax(
      this.constants.embed_avg.map(
        ([, , color]) => -color_distance(color, target_color),
      ),
      this.constants.temperature,
    ),
  );
  const c1 = this.constants.embed_palette[pair_index[0]];
  const c2 = this.constants.embed_palette[pair_index[1]];
  const c12 = vector_sub(c2, c1);
  const c10 = vector_sub(target_color, c1);
  const threshold = vector_dot(c12, c10) / vector_dot(c12, c12);
  const color =
    this.constants.color_palette[pair_index[seed < threshold ? 1 : 0]];
  this.color(color[0], color[1], color[2], a);
}

export function applyDithering_Ordered(
  buffer: ImageData,
  color_palette: SRGBColor[],
  {
    temperature = 0,
    mask_size = 16,
  }: {
    temperature?: number;
    mask_size?: number;
  } = {},
) {
  const cmap = normalize_map(
    threshold_map(mask_size, [
      [0, 2],
      [3, 1],
    ]),
  );
  const embed_palette = color_palette.map(srgb2embed);
  const embed_avg: [number, number, XYZColor][] = embed_palette
    .map((c1, i) =>
      embed_palette.map(
        (c2, j) =>
          [i, j, vector_mult(vector_add(c1, c2), 0.5)] as [
            number,
            number,
            XYZColor,
          ],
      ),
    )
    .flat()
    .filter(([i, j]) => i > j);
  const runner = kernelRunner(
    _applyDithering_Ordered,
    {
      cmap,
      color_palette,
      embed_palette,
      embed_avg,
      temperature,
    },
    buffer,
  );
  return runner();
}

export function applyDithering_ErrorDiffusion(
  buffer: ImageData,
  color_palette: SRGBColor[],
  {
    temperature = 0,
    err_decay = 1.0,
  }: {
    temperature?: number;
    err_decay?: number;
  } = {},
) {
  const color_palette_ = color_palette.map(srgb2embed);
  const err_diffusion: [[number, number], number][] = [
    // [[+1, 0], 1 / 8],
    // [[+2, 0], 1 / 8],
    // [[-1, 1], 1 / 8],
    // [[+0, 1], 1 / 8],
    // [[+1, 1], 1 / 8],
    // [[+0, 2], 1 / 8],
    // [[+1, 0], 7 / 16],
    // [[-1, 1], 3 / 16],
    // [[+0, 1], 5 / 16],
    // [[+1, 1], 1 / 16],
    [[+1, 0], 7 / 48],
    [[+2, 0], 5 / 48],
    [[-2, 1], 3 / 48],
    [[-1, 1], 5 / 48],
    [[+0, 1], 7 / 48],
    [[+1, 1], 5 / 48],
    [[+2, 1], 3 / 48],
    [[-2, 2], 1 / 48],
    [[-1, 2], 3 / 48],
    [[+0, 2], 5 / 48],
    [[+1, 2], 3 / 48],
    [[+2, 2], 1 / 48],
  ];

  const buffer_ = new Array(buffer.width * buffer.height)
    .fill(0)
    .map((_, i) =>
      srgb2embed([
        buffer.data[i * 4 + 0] / 255,
        buffer.data[i * 4 + 1] / 255,
        buffer.data[i * 4 + 2] / 255,
      ]),
    );
  for (let j = 0; j < buffer.height; j++) {
    for (let i = 0; i < buffer.width; i++) {
      const index = j * buffer.width + i;
      const target_color = buffer_[index];
      const color_index = sample(
        color_palette.map((_, i) => i),
        softargmax(
          color_palette_.map((color) => -color_distance(color, target_color)),
          temperature,
        ),
      );
      const err = vector_mult(
        vector_sub(target_color, color_palette_[color_index]),
        buffer.data[index * 4 + 3] / 255,
      );
      err_diffusion.forEach(([ind, w]) => {
        const i_ = i + ind[0];
        const j_ = j + ind[1];
        if (0 > i_ || i_ >= buffer.width || 0 > j_ || j_ >= buffer.height)
          return;
        const index = j_ * buffer.width + i_;
        const diff = vector_mult(err, w * err_decay);
        for (let k = 0; k < 3; k++) buffer_[index][k] += diff[k];
      });
      buffer.data[index * 4 + 0] = color_palette[color_index][0] * 255;
      buffer.data[index * 4 + 1] = color_palette[color_index][1] * 255;
      buffer.data[index * 4 + 2] = color_palette[color_index][2] * 255;
    }
  }
}
