import {
  vector_add,
  vector_mult,
  vector_scale,
  vector_sub,
} from "@/utils/math/vector.js";

import { MAX_LUM, MIN_LUM } from "./const.js";
import { default_mode, getToColor, toRGB, wavelengths } from "./spectrum.js";
import type { TSpectrum } from "./spectrum.ts";

const to_lum = await getToColor(
  {
    mode: "CIE1931XYZ",
    max_ref: "none",
    max_mode: "global",
  },
  "lum",
);

export class Light {
  color: TSpectrum;
  constructor(color: TSpectrum) {
    this.color = color;
  }
  async rgb(mode = default_mode) {
    return await toRGB(this.color, mode);
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

  get weight(): number {
    return to_lum(this.color)[0];
  }
}

export class Dye {
  color: TSpectrum;
  constructor(color: TSpectrum) {
    this.color = color;
  }
  async rgb(mode = default_mode) {
    return await Light.white.apply(this).rgb(mode);
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

  get weight(): number {
    return Light.white.apply(this).weight / Light.white.weight;
  }
}

export class LightAccumulator {
  private _history_size: number;
  private _acc: TSpectrum;
  private _w1: number;
  private _w2: number;
  private _sample_count: number;
  constructor(history_size: number = 65536) {
    this._acc = wavelengths.map(() => 0) as TSpectrum;
    this._w1 = 0;
    this._w2 = 0;
    this._sample_count = 0;
    this._history_size = history_size;
  }

  get color() {
    return this._acc;
  }

  async rgb(mode = default_mode) {
    return await toRGB(this.color, mode);
  }

  get n() {
    return this._sample_count;
  }
  get avg() {
    return this._w1;
  }
  get var() {
    return this._sample_count > 1 ? this._w2 : 0.0;
  }
  get se() {
    return this._sample_count > 0
      ? Math.sqrt(this.var / this._sample_count)
      : 0.0;
  }

  accumulate(light: Light | TSpectrum) {
    if (!(light instanceof Light)) {
      light = new Light(light);
    }
    this._sample_count++;
    this._sample_count = Math.min(this._sample_count, this._history_size);
    this._acc = vector_add(
      this._acc,
      vector_scale(vector_sub(light.color, this._acc), 1 / this._sample_count),
    );

    const w = light.weight;
    const d1 = w - this._w1;
    this._w1 += d1 / this._sample_count;
    const d2 = w - this._w1;
    if (this._sample_count <= 2) this._w2 += d1 * d2;
    else this._w2 += (d1 * d2 - this._w2) / (this._sample_count - 1);
    return this;
  }
}
