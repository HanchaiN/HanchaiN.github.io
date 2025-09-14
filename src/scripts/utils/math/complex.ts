/* eslint-disable no-loss-of-precision,@typescript-eslint/no-loss-of-precision */
import { factorial, powneg, productRange } from "./utils.js";

export type TComplex = [re: number, im: number];
export function complex_conj(z: TComplex): TComplex {
  return [z[0], -z[1]];
}
export function complex_absSq(z: TComplex) {
  return z[0] * z[0] + z[1] * z[1];
}
export function complex_add(z1: TComplex, z2: TComplex): TComplex {
  return [z1[0] + z2[0], z1[1] + z2[1]];
}
export function complex_scale(z: TComplex, v: number): TComplex {
  return [z[0] * v, z[1] * v];
}
export function complex_add_inv(z: TComplex): TComplex {
  return complex_scale(z, -1);
}
export function complex_sub(z1: TComplex, z2: TComplex): TComplex {
  return [z1[0] - z2[0], z1[1] - z2[1]];
}
export function complex_mult(z1: TComplex, z2: TComplex): TComplex {
  return [z1[0] * z2[0] - z1[1] * z2[1], z1[0] * z2[1] + z1[1] * z2[0]];
}
export function complex_mult_inv(z: TComplex): TComplex {
  return complex_scale(complex_conj(z), 1 / complex_absSq(z));
}
export function complex_div(z1: TComplex, z2: TComplex): TComplex {
  return complex_mult(z1, complex_mult_inv(z2));
}
export function complex_sin(z: TComplex): TComplex {
  return [Math.sin(z[0]) * Math.cosh(z[1]), Math.cos(z[0]) * Math.sinh(z[1])];
}
export function complex_exp(z: TComplex): TComplex {
  return [Math.exp(z[0]) * Math.cos(z[1]), Math.exp(z[0]) * Math.sin(z[1])];
}
export function complex_log(z: TComplex): TComplex {
  return [Math.log(Math.sqrt(complex_absSq(z))), Math.atan2(z[1], z[0])];
}
export function complex_pow(z: TComplex, w: TComplex): TComplex {
  if (w[1] === 0)
    return [
      Math.pow(complex_absSq(z), w[0] / 2) *
        Math.cos(Math.atan2(z[1], z[0]) * w[0]),
      Math.pow(complex_absSq(z), w[0] / 2) *
        Math.sin(Math.atan2(z[1], z[0]) * w[0]),
    ];
  return complex_exp(complex_mult(complex_log(z), w));
}
export function complex_gamma(z: TComplex): TComplex {
  let reflected = false;
  // if (z[1] === 0)
  //     return [gamma(z[0]), 0];
  if (z[0] < 0.5) {
    z = complex_sub([1, 0], z);
    reflected = true;
  }
  z = complex_add(z, [-1, 0]);
  let x: TComplex = [0.99999999999999709182, 0];
  x = complex_add(
    x,
    complex_div([57.156235665862923517, 0], complex_add(z, [1, 0])),
  );
  x = complex_add(
    x,
    complex_div([-59.597960355475491248, 0], complex_add(z, [2, 0])),
  );
  x = complex_add(
    x,
    complex_div([14.136097974741747174, 0], complex_add(z, [3, 0])),
  );
  x = complex_add(
    x,
    complex_div([-0.49191381609762019978, 0], complex_add(z, [4, 0])),
  );
  x = complex_add(
    x,
    complex_div([0.33994649984811888699e-4, 0], complex_add(z, [5, 0])),
  );
  x = complex_add(
    x,
    complex_div([0.46523628927048575665e-4, 0], complex_add(z, [6, 0])),
  );
  x = complex_add(
    x,
    complex_div([-0.98374475304879564677e-4, 0], complex_add(z, [7, 0])),
  );
  x = complex_add(
    x,
    complex_div([0.15808870322491248884e-3, 0], complex_add(z, [8, 0])),
  );
  x = complex_add(
    x,
    complex_div([-0.21026444172410488319e-3, 0], complex_add(z, [9, 0])),
  );
  x = complex_add(
    x,
    complex_div([0.2174396181152126432e-3, 0], complex_add(z, [10, 0])),
  );
  x = complex_add(
    x,
    complex_div([-0.16431810653676389022e-3, 0], complex_add(z, [11, 0])),
  );
  x = complex_add(
    x,
    complex_div([0.84418223983852743293e-4, 0], complex_add(z, [12, 0])),
  );
  x = complex_add(
    x,
    complex_div([-0.2619083840158140867e-4, 0], complex_add(z, [13, 0])),
  );
  x = complex_add(
    x,
    complex_div([0.36899182659531622704e-5, 0], complex_add(z, [14, 0])),
  );
  const t = complex_add(z, [4.7421875 + 0.5, 0]);
  const result = complex_div(
    complex_mult(
      complex_mult(x, [Math.sqrt(2 * Math.PI), 0]),
      complex_exp(complex_mult(complex_add(z, [0.5, 0]), complex_log(t))),
    ),
    complex_exp(t),
  );
  return reflected
    ? complex_div(
        complex_div([Math.PI, 0], complex_sin(complex_scale(z, -Math.PI))),
        result,
      )
    : result;
}
export function complex_zeta(s: TComplex): TComplex;
export function complex_zeta(s: TComplex, prec: number): TComplex;
export function complex_zeta(s: TComplex, prec: number = 1e-10): TComplex {
  const f0 = 0.0;
  if (complex_absSq(s) === f0) return [-0.5, 0];
  const dec = -Math.round(Math.log(prec * 0.1) / Math.LN10);
  const n = Math.min(Math.round(1.3 * dec + 0.9 * Math.abs(s[1])), 60);
  let reflected = false;

  if (s[0] <= 1 && s[0] != 0) {
    reflected = true;
    s = complex_sub([1, 0], s);
  }
  let S: TComplex = [0, 0];
  for (let k = 1; k <= n; k++) {
    let T = 0.0;
    for (let j = k; j <= n; j++) {
      T +=
        (productRange(n - j + 1, n + j - 1) * Math.pow(4, j)) /
        factorial(2 * j);
    }
    S = complex_add(
      S,
      complex_div(
        [powneg(k - 1) * n * T, 0],
        complex_exp(complex_scale(s, Math.log(k))),
      ),
    );
  }
  let T = 0.0;
  for (let j = 0; j <= n; j++) {
    T +=
      (productRange(n - j + 1, n + j - 1) * Math.pow(4, j)) / factorial(2 * j);
  }
  const result = complex_div(
    S,
    complex_scale(
      complex_add(
        complex_exp(complex_scale(complex_sub([1, 0], s), Math.LN2)),
        [-1, 0],
      ),
      -n * T,
    ),
  );
  return reflected
    ? complex_mult(
        complex_mult(
          complex_mult(
            complex_mult(
              complex_exp(complex_scale(complex_sub([1, 0], s), Math.LN2)),
              complex_exp(complex_scale(s, -Math.log(Math.PI))),
            ),
            complex_sin(complex_scale(complex_sub([1, 0], s), Math.PI / 2)),
          ),
          complex_gamma(s),
        ),
        result,
      )
    : result;
}

export class Complex {
  private _re!: number;
  private _im!: number;
  static get I() {
    return new Complex().set(0, 1);
  }
  private constructor() {}
  get re() {
    return this._re;
  }
  get im() {
    return this._im;
  }
  get r() {
    return this.abs();
  }
  get theta() {
    return Math.atan2(this.im, this.re);
  }
  set(re = 0, im = 0) {
    this._re = re;
    this._im = im;
    return this;
  }
  static fromCartesian(re = 0, im = 0) {
    return new Complex().set(re, im);
  }
  setPolar(r = 0, theta = 0) {
    this._re = r * Math.cos(theta);
    this._im = r * Math.sin(theta);
    return this;
  }
  static fromPolar(r = 0, theta = 0) {
    return new Complex().setPolar(r, theta);
  }
  copy() {
    return Complex.copy(this);
  }
  static copy(v: Complex | number) {
    if (v instanceof Complex) {
      return new Complex().set(v.re, v.im);
    }
    if (typeof v === "number") {
      return Complex.fromCartesian(v);
    }
    throw new TypeError();
  }
  conj() {
    return Complex.fromCartesian(this.re, -this.im);
  }
  static conj(v: number | Complex) {
    return Complex.copy(v).conj();
  }
  absSq() {
    return this.conj().mult(this).re;
  }
  static absSq(v: number | Complex) {
    return Complex.copy(v).absSq();
  }
  abs() {
    return Math.sqrt(this.absSq());
  }
  static abs(v: number | Complex) {
    return Complex.copy(v).abs();
  }
  add(v: Complex | number) {
    if (v instanceof Complex) {
      this.set(this.re + v.re, this.im + v.im);
    }
    if (typeof v === "number") {
      this.set(this.re + v, this.im);
    }
    return this;
  }
  static add(...args: (Complex | number)[]) {
    const z = Complex.fromCartesian(0, 0);
    for (const v of args) z.add(v);
    return z;
  }
  sub(v: Complex | number) {
    if (v instanceof Complex) {
      this.set(this.re - v.re, this.im - v.im);
    }
    if (typeof v === "number") {
      this.set(this.re - v, this.im);
    }
    return this;
  }
  static sub(a: Complex | number, b: Complex | number) {
    return Complex.copy(a).sub(b);
  }
  mult(v: number | Complex) {
    if (v instanceof Complex) {
      this.set(
        this.re * v.re - this.im * v.im,
        this.re * v.im + this.im * v.re,
      );
    }
    if (typeof v === "number") {
      this.set(this.re * v, this.im * v);
    }
    return this;
  }
  static mult(...args: (number | Complex)[]) {
    const z = Complex.fromCartesian(1, 0);
    for (const v of args) z.mult(v);
    return z;
  }
  div(v: number | Complex) {
    if (v instanceof Complex) {
      this.mult(v.conj()).div(v.absSq());
    }
    if (typeof v === "number") {
      this.set(this.re / v, this.im / v);
    }
    return this;
  }
  static div(a: number | Complex, b: number | Complex) {
    return Complex.copy(a).div(b);
  }
  exp() {
    return Complex.fromPolar(Math.exp(this.re), this.im);
  }
  static exp(z: number | Complex) {
    return Complex.copy(z).exp();
  }
  log() {
    return Complex.fromCartesian(Math.log(this.r), this.theta);
  }
  static log(z: number | Complex) {
    return Complex.copy(z).log();
  }
  pow(v: number) {
    return Complex.fromPolar(Math.pow(this.r, v), this.theta * v);
  }
  static pow(a: number | Complex, b: number | Complex) {
    if (b instanceof Complex) return Complex.mult(b, Complex.log(a)).exp();
    if (a instanceof Complex) return a.pow(b);
    if (typeof a === "number") return Complex.copy(Math.pow(a, b));
    throw new TypeError();
  }
  sinh() {
    return Complex.fromCartesian(
      Math.sinh(this.re) * Math.cos(this.im),
      Math.cosh(this.re) * Math.sin(this.im),
    );
  }
  cosh() {
    return Complex.fromCartesian(
      Math.cosh(this.re) * Math.cos(this.im),
      Math.sinh(this.re) * Math.sin(this.im),
    );
  }
  sin() {
    return Complex.fromCartesian(
      Math.sin(this.re) * Math.cosh(this.im),
      Math.cos(this.re) * Math.sinh(this.im),
    );
  }
  static sin(z: number | Complex) {
    return this.copy(z).sin();
  }
  cos() {
    return Complex.fromCartesian(
      Math.cos(this.re) * Math.cosh(this.im),
      Math.sin(this.re) * Math.sinh(this.im),
    );
  }
  static gamma(n: Complex): Complex;
  static gamma(n: number): number;
  static gamma(n: Complex | number) {
    const gammaP = [
      0.99999999999999709182, 57.156235665862923517, -59.597960355475491248,
      14.136097974741747174, -0.49191381609762019978, 0.33994649984811888699e-4,
      0.46523628927048575665e-4, -0.98374475304879564677e-4,
      0.15808870322491248884e-3, -0.21026444172410488319e-3,
      0.2174396181152126432e-3, -0.16431810653676389022e-3,
      0.84418223983852743293e-4, -0.2619083840158140867e-4,
      0.36899182659531622704e-5,
    ];
    const gammaG = 4.7421875;
    if (typeof n === "number") {
      if (Number.isInteger(n)) {
        if (n <= 0) return Number.isFinite(n) ? Infinity : NaN;
        if (n > 171) return Infinity;
        return factorial(n - 1);
      }
      if (n < 0.5)
        return Math.PI / (Math.sin(Math.PI * n) * Complex.gamma(1 - n));
      if (n > 171.35) return Infinity;
      if (n > 85.0)
        return (
          Math.sqrt((2 * Math.PI) / n) *
          Math.pow(n / Math.E, n) *
          (1 +
            1 / (12 * Math.pow(n, 1)) +
            1 / (288 * Math.pow(n, 2)) -
            139 / (51840 * Math.pow(n, 3)) -
            571 / (2488320 * Math.pow(n, 4)) +
            163879 / (209018880 * Math.pow(n, 5)) +
            5246819 / (75246796800 * Math.pow(n, 6)))
        );
      n--;
      let x = gammaP[0];
      for (let i = 1; i < gammaP.length; i++) x += gammaP[i] / (n + i);
      const t = n + gammaG + 0.5;
      return x * Math.sqrt(2 * Math.PI) * Math.pow(t, n + 0.5) * Math.exp(-t);
    }
    if (n instanceof Complex) {
      if (n.im === 0) return Complex.copy(Complex.gamma(n.re));
      if (n.re < 0.5)
        return Complex.copy(Math.PI)
          .div(Complex.mult(n, Math.PI).sin())
          .div(Complex.gamma(Complex.sub(1.0, n)));
      const z = n.copy().sub(1);
      const x = Complex.fromCartesian(gammaP[0]);
      for (let i = 1; i < gammaP.length; i++)
        x.add(Complex.div(gammaP[i], Complex.add(z, i)));
      const t = Complex.add(z, gammaG, 0.5);
      return x
        .copy()
        .mult(Complex.copy(Math.sqrt(2 * Math.PI)))
        .mult(Complex.pow(t, Complex.add(z, 0.5)))
        .div(Complex.exp(t));
    }
  }
  static zeta(s: Complex, prec = 1e-3, only = false): Complex {
    const z = Complex.copy(s);
    if (z.absSq() === 0) return Complex.fromCartesian(-0.5);
    const dec = -Math.round(Math.log(prec * 0.1) / Math.log(10));
    const n = Math.min(Math.round(1.3 * dec + 0.9 * Math.abs(z.im)), 60);

    function d(k: number) {
      let S = 0;
      for (let j = k; j <= n; j++) {
        S += (productRange(n - j + 1, n + j - 1) * 4 ** j) / factorial(2 * j);
      }
      return n * S;
    }
    function f(z: Complex) {
      const S = Complex.copy(0);
      for (let k = 1; k <= n; k++) {
        S.add(Complex.div(Math.pow(-1, k - 1) * d(k), Complex.pow(k, z)));
      }
      return S.div(Complex.pow(2, Complex.sub(1, z)).sub(1).mult(-d(0)));
    }
    if (z.re > 1 || z.re == 0 || only) {
      return f(z);
    }
    return Complex.pow(2, z)
      .mult(Complex.pow(Math.PI, Complex.sub(z, 1)))
      .mult(
        Complex.mult(z, Math.PI / 2)
          .sin()
          .copy(),
      )
      .mult(Complex.gamma(Complex.sub(1, z)))
      .mult(Complex.zeta(Complex.sub(1, z), prec, true));
  }
}
