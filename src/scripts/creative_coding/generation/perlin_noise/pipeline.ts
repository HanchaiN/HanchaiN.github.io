import convert_color from "@/scripts/utils/color/conversion.js";
import { PerlinNoise } from "@/scripts/utils/math/noise.js";
import { map } from "@/scripts/utils/math/utils.js";

const okhcl2srgb = convert_color("okhcl", "srgb")!;

export function generate(buffer: ImageData) {
  const noise = new PerlinNoise();
  const init_hue = Math.random();
  buffer.data.fill(255);
  for (let j = 0; j < buffer.height; j++) {
    const x = j / buffer.height;
    for (let i = 0; i < buffer.width; i++) {
      const y = i / buffer.width;
      const index = (j * buffer.width + i) * 4;
      const [r, g, b] = okhcl2srgb([
        map(
          noise.noise(x * 6, y * 6, 255),
          -1,
          1,
          init_hue - 1.0,
          init_hue + 1.0,
        ),
        map(noise.noise(x * 4, y * 4, 128), -1, 1, 0.05, 0.25),
        map(noise.noise(x * 3, y * 3, 0), -1, 1, 0.75, 0.85),
      ]);
      buffer.data[index + 0] = r * 255;
      buffer.data[index + 1] = g * 255;
      buffer.data[index + 2] = b * 255;
    }
  }
}
