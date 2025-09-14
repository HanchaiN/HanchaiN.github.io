import type { RGBColor } from "@/scripts/utils/color/conversion.ts";
import { sum } from "@/scripts/utils/math/utils.js";
import {
  vector_add,
  vector_mult,
  vector_scale,
  vector_sub,
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
  return new Array(3)
    .fill(0)
    .map((_, i) =>
      sum(v.map((val, j) => val * camera_response[i][j])),
    ) as RGBColor;
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

export class LightAccumulator {
  private _history_size: number;
  private _acc: TSpectrum;
  private _err: TSpectrum;
  private _smoothing: number;
  private _sample_count: number;
  constructor(history_size: number = 65536) {
    this._acc = wavelengths.map(() => 0) as TSpectrum;
    this._err = wavelengths.map(() => 0) as TSpectrum;
    this._history_size = history_size;
    this._smoothing = 1 - Math.exp(-1 / this._history_size);
    this._sample_count = 0;
  }

  get color() {
    return this._sample_count <= this._history_size
      ? vector_scale(vector_sub(this._acc, this._err), 1 / this._sample_count)
      : this._acc;
  }

  rgb() {
    return toRGB(this.color);
  }

  accumulate(light: Light | TSpectrum) {
    if (light instanceof Light) {
      light = light.color;
    }
    if (this._sample_count < this._history_size) {
      const v = vector_sub(light, this._err);
      const acc = vector_add(this._acc, v);
      this._err = vector_sub(vector_sub(acc, this._acc), v);
      this._acc = acc;
      this._sample_count++;
      return this;
    }
    if (this._sample_count === this._history_size) {
      this._acc = this.color;
      this._err = wavelengths.map(() => 0) as TSpectrum;
    }
    this._acc = vector_add(
      vector_scale(this._acc, 1 - this._smoothing),
      vector_scale(light, this._smoothing),
    );
    this._sample_count++;
    return this;
  }
}
