import {
  sample,
  vector_magSq,
  vector_mult,
  vector_sub,
} from "@/scripts/utils/math/index.js";
import { softargmax } from "@/scripts/utils/math/utils.js";
import convert_color from "@/scripts/utils/color/conversion.js";
import type {
  ColorSpace,
  SRGBColor,
} from "@/scripts/utils/color/conversion.js";

const mode: ColorSpace = "xyz";
const srgb2embed = convert_color("srgb", mode)!;

export function applyDithering(
  buffer: ImageData,
  color_palette: SRGBColor[],
  temperature = 0,
) {
  const embed = (c: SRGBColor) => {
    return srgb2embed(c);
  };
  const color_palette_ = color_palette.map(embed);
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
      embed([
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
          color_palette_.map(
            (color) => -vector_magSq(vector_sub(color, target_color)),
          ),
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
        const diff = vector_mult(err, w);
        for (let k = 0; k < 3; k++) buffer_[index][k] += diff[k];
      });
      buffer.data[index * 4 + 0] = color_palette[color_index][0] * 255;
      buffer.data[index * 4 + 1] = color_palette[color_index][1] * 255;
      buffer.data[index * 4 + 2] = color_palette[color_index][2] * 255;
    }
  }
}
