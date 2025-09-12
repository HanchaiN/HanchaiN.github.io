import convert_color from "@/scripts/utils/color/conversion.js";
import type { RGBColor, XYZColor } from "@/scripts/utils/color/conversion.ts";

import { MAX_LUM, MIN_LUM } from "./const.js";

export type TColor = [v500: number, v600: number, v700: number];
const color_lookup: [v500: XYZColor, v600: XYZColor, v700: XYZColor] = [
  [0.0049, 0.323, 0.272],
  [1.0622, 0.631, 0.0008],
  [0.01135916, 0.004102, 0],
];
const xyz2rgb = convert_color("xyz", "rgb")!;

function toRGB([v500, v600, v700]: TColor): RGBColor {
  return xyz2rgb([
    v500 * color_lookup[0][0] +
      v600 * color_lookup[1][0] +
      v700 * color_lookup[2][0],
    v500 * color_lookup[0][1] +
      v600 * color_lookup[1][1] +
      v700 * color_lookup[2][1],
    v500 * color_lookup[0][2] +
      v600 * color_lookup[1][2] +
      v700 * color_lookup[2][2],
  ]);
}

export class Light {
  color: TColor;
  constructor(color: TColor) {
    this.color = color;
  }
  rgb() {
    return toRGB(this.color);
  }
  clone() {
    return new Light([...this.color]);
  }
  mix(other: Light) {
    for (let i = 0; i < this.color.length; i++) {
      this.color[i] += other.color[i];
    }
    return this;
  }
  mult(fac: number) {
    for (let i = 0; i < this.color.length; i++) {
      this.color[i] *= fac;
    }
    return this;
  }
  apply(dye: Dye) {
    for (let i = 0; i < this.color.length; i++) {
      this.color[i] *= dye.color[i];
    }
    return this;
  }
  static get black() {
    return new Light([0, 0, 0]);
  }
  static get white() {
    return new Light([MAX_LUM, MAX_LUM, MAX_LUM]);
  }
}

export class Dye {
  color: TColor;
  constructor(color: TColor) {
    this.color = color;
  }
  rgb() {
    return Light.white.apply(this).rgb();
  }
  clone() {
    return new Dye([...this.color]);
  }
  lightMix(other: Dye) {
    for (let i = 0; i < this.color.length; i++) {
      this.color[i] += other.color[i];
    }
    return this;
  }
  lightMult(fac: number) {
    for (let i = 0; i < this.color.length; i++) {
      this.color[i] *= fac;
    }
    return this;
  }
  mix(other: Dye) {
    for (let i = 0; i < this.color.length; i++) {
      this.color[i] *= other.color[i];
    }
    return this;
  }
  mult(fac: number) {
    for (let i = 0; i < this.color.length; i++) {
      this.color[i] = Math.pow(this.color[i], fac);
    }
    return this;
  }
  static get black() {
    return new Dye([0, 0, 0]);
  }
  static get white() {
    return new Dye([1, 1, 1]);
  }
  isBlack() {
    return this.color.every((v) => v < MIN_LUM);
  }
}
