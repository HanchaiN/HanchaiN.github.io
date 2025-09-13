import type { RGBColor } from "@/scripts/utils/color/conversion.ts";
import {
  vector_add,
  vector_mult,
  vector_scale,
} from "@/scripts/utils/math/vector.js";

import { MAX_LUM, MIN_LUM } from "./const.js";
import { readSpectrum, wavelengths } from "./data.js";
import type { TSpectrum } from "./data.ts";

const _camera_response = (
  await import("./data/camera_response.json", { with: { type: "json" } })
).default;
// const _ref_light = (await import("./data/light.json", { with: { type: "json" } })).default;

const camera_response: [r: TSpectrum, g: TSpectrum, b: TSpectrum] = [
  await readSpectrum(_camera_response, "R"),
  await readSpectrum(_camera_response, "G"),
  await readSpectrum(_camera_response, "B"),
];
const max_response = _toRGB(
  wavelengths.map(() => MAX_LUM) as TSpectrum,
  // await readSpectrum(_ref_light, "intensity")
);
function _toRGB(v: TSpectrum): RGBColor {
  return [
    v.reduce((acc, val, i) => acc + val * camera_response[0][i], 0),
    v.reduce((acc, val, i) => acc + val * camera_response[1][i], 0),
    v.reduce((acc, val, i) => acc + val * camera_response[2][i], 0),
  ];
}
export function toRGB(v: TSpectrum): RGBColor {
  const rgb = _toRGB(v);
  return rgb.map((c, i) => c / max_response[i]) as RGBColor;
}

export class Light {
  color: TSpectrum;
  constructor(color: TSpectrum) {
    this.color = color;
  }
  rgb() {
    return toRGB(this.color);
  }
  clone() {
    return new Light([...this.color] as TSpectrum);
  }
  mix(other: Light) {
    this.color = vector_add(this.color, other.color);
    return this;
  }
  mult(fac: number) {
    this.color = vector_scale(this.color, fac);
    return this;
  }
  apply(dye: Dye) {
    this.color = vector_mult(this.color, dye.color);
    return this;
  }
  static get black() {
    return new Light(wavelengths.map(() => 0) as TSpectrum);
  }
  static get white() {
    return new Light(wavelengths.map(() => MAX_LUM) as TSpectrum);
  }
}

export class Dye {
  color: TSpectrum;
  constructor(color: TSpectrum) {
    this.color = color;
  }
  rgb() {
    return Light.white.apply(this).rgb();
  }
  clone() {
    return new Dye([...this.color] as TSpectrum);
  }
  lightMix(other: Dye) {
    this.color = vector_add(this.color, other.color);
    return this;
  }
  lightMult(fac: number) {
    this.color = vector_scale(this.color, fac);
    return this;
  }
  mix(other: Dye) {
    this.color = vector_mult(this.color, other.color);
    return this;
  }
  mult(fac: number) {
    this.color = this.color.map((v) => Math.pow(v, fac)) as TSpectrum;
    return this;
  }
  static get black() {
    return new Dye(wavelengths.map(() => 0) as TSpectrum);
  }
  static get white() {
    return new Dye(wavelengths.map(() => 1) as TSpectrum);
  }
  isBlack() {
    return this.color.every((v) => v < MIN_LUM);
  }
}
