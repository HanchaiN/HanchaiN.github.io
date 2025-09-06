import { lerp } from "./utils.js";
import { vector_fromPolar, vector_fromSphere } from "./vector.js";
export function randomUniform(l = 0, h = 1) {
  return lerp(Math.random(), l, h);
}
export function randomGaussian(mu = 0, sigma = 1) {
  const U1 = Math.random(),
    U2 = Math.random();
  const Z0 = Math.sqrt(-2 * Math.log(U1)) * Math.cos(2 * Math.PI * U2);
  // Z1 = Math.sqrt(-2 * Math.log(U1)) * Math.sin(2 * Math.PI * U2);
  return Z0 * sigma + mu;
}
export function randomChi(alpha = 1) {
  if (alpha < 1.0) return 0.0;
  // if (!Number.isInteger(alpha)) {
  const beta = Math.sqrt(alpha - 1);
  const vp = (Math.exp(-1 / 2) * (Math.SQRT1_2 + beta)) / (0.5 + beta);
  const vn = Math.max(-beta, -Math.exp(-1 / 2) * (1 - 0.25 / alpha));
  for (let _ = 0; _ < 1000; _++) {
    const u = randomUniform(0, 1),
      v = randomUniform(vn, vp);
    const z = v / u;
    if (z < -beta) continue;
    let r = 2.5 - z * z;
    if (z < 0) r += ((z * z * z) / 3) * (z + beta);
    if (u < r / (2 * Math.exp(1 / 4))) return z + beta;
    if (z * z > (4 * Math.exp(1.35)) / u + 1.4) continue;
    const h =
      Math.pow(1 + z / beta, beta * beta) * Math.exp((-z * z) / 2 - z * beta);
    if (-2 * Math.log(u) < Math.log(h)) return z + beta;
  }
  // }
  let acc = 0.0;
  for (let _ = 0; _ < Math.ceil(alpha); _++)
    acc += Math.pow(randomGaussian(0, 1), 2);
  return Math.sqrt(acc);
}
export function sample<T>(array: T[], prob: number[] = []) {
  if (prob.length !== 0) {
    const r = Math.random() * prob.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let i = 0; i < array.length; i++) {
      acc += prob[i];
      if (r < acc) return array[i];
    }
  }
  return array[Math.floor(Math.random() * array.length)];
}

export function vector_random2D() {
  const angle = randomUniform(0, Math.PI * 2);
  return vector_fromPolar(1, angle);
}
export function vector_random3D() {
  const angle = randomUniform(0, Math.PI * 2);
  const vz = randomUniform(-1, 1);
  return vector_fromSphere(1, Math.acos(vz), angle);
}

// Alea random number generator.
//----------------------------------------------------------------------------//

// From http://baagoe.com/en/RandomMusings/javascript/
export class Alea {
  static version = "Alea 0.9";
  s0: number;
  s1: number;
  s2: number;
  c: number;
  seed: string[];
  constructor(...seed: string[]) {
    // Johannes BaagÃ¸e <baagoe@baagoe.com>, 2010
    this.c = 1;

    if (seed.length == 0) {
      seed = [(+new Date()).toString()];
    }
    this.s0 = Mash.mash(" ");
    this.s1 = Mash.mash(" ");
    this.s2 = Mash.mash(" ");

    for (let i = 0; i < seed.length; i++) {
      this.s0 -= Mash.mash(seed[i]);
      if (this.s0 < 0) {
        this.s0 += 1;
      }
      this.s1 -= Mash.mash(seed[i]);
      if (this.s1 < 0) {
        this.s1 += 1;
      }
      this.s2 -= Mash.mash(seed[i]);
      if (this.s2 < 0) {
        this.s2 += 1;
      }
    }
    this.seed = seed;
  }
  random() {
    const t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10; // 2^-32
    this.s0 = this.s1;
    this.s1 = this.s2;
    return (this.s2 = t - (this.c = t | 0));
  }
  random_uint32() {
    return this.random() * 0x100000000; // 2^32
  }
  random_frac53() {
    return (
      this.random() + ((this.random() * 0x200000) | 0) * 1.1102230246251565e-16
    ); // 2^-53
  }
}

// From http://baagoe.com/en/RandomMusings/javascript/
// Johannes BaagÃ¸e <baagoe@baagoe.com>, 2010
export class Mash {
  static n = 0xefc8249d;
  static version = "Mash 0.9";

  static mash(data: string) {
    for (let i = 0; i < data.length; i++) {
      this.n += data.charCodeAt(i);
      let h = 0.02519603282416938 * this.n;
      this.n = h >>> 0;
      h -= this.n;
      h *= this.n;
      this.n = h >>> 0;
      h -= this.n;
      this.n += h * 0x100000000; // 2^32
    }
    return (this.n >>> 0) * 2.3283064365386963e-10; // 2^-32
  }
}

export function shuffleArray<T>(array: T[]): T[] {
  return array.sort(() => Math.random() - 0.5);
}
