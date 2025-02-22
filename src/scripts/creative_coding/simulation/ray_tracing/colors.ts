import { MAX_LUM, MIN_LUM } from "./const.js";

export type TColor = [v500: number, v600: number, v700: number];
export type TColorRGB = [r: number, g: number, b: number];

function toRGB([v500, v600, v700]: TColor): TColorRGB {
  return [(v600 + v700) / 2, (v500 + v600) / 2, (0 + v500) / 2];
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
