import {
  vector_add,
  vector_mult,
  vector_scale,
  vector_sub,
} from "@/scripts/utils/math/vector.js";

import { MAX_LUM, MIN_LUM } from "./const.js";
import { default_mode, toRGB, wavelengths } from "./spectrum.js";
import type { TSpectrum } from "./spectrum.ts";

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

  async rgb(mode = default_mode) {
    return await toRGB(this.color, mode);
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
