/* eslint-disable no-loss-of-precision,@typescript-eslint/no-loss-of-precision */

type numberArray = number[] | Float32Array | Float64Array;

export function constrain(v: number, l: number, h: number) {
  return Math.min(h, Math.max(l, v));
}
export function map(v: number, l: number, h: number, l_: number, h_: number) {
  if (Math.abs(h - l) < 1e-10) {
    const r = (l + h) / 2;
    if (v < r === l <= h) return l_ < h_ ? -Infinity : Infinity;
    if (v > r === l <= h) return l_ < h_ ? Infinity : -Infinity;
    return (l_ + h_) / 2;
  }
  return l_ + ((v - l) * (h_ - l_)) / (h - l);
}
export function lerp(v: number, l: number, h: number) {
  return map(v, 0, 1, l, h);
}
export function constrainMap(
  v: number,
  l: number,
  h: number,
  l_: number,
  h_: number,
) {
  return lerp(constrain(map(v, l, h, 0, 1), 0, 1), l_, h_);
}
export function constrainLerp(v: number, l: number, h: number) {
  return constrainMap(v, 0, 1, l, h);
}
export function fpart(x: number) {
  return x - Math.floor(x);
}
export function powneg(x: number) {
  return Math.pow(-1, x);
}
export function sigm(x: number) {
  return 1 / (1 + Math.exp(-x));
}
export function gaus(x: number) {
  return Math.exp(-x * x);
}
export function ricker(x: number) {
  return (1 - x * x) * Math.exp((-x * x) / 2);
}
export function symlog(x: number) {
  return x > 0 ? Math.log(1 + x) : -Math.log(1 - x);
}
export function symlog_inv(x: number) {
  return x > 0 ? Math.exp(x) - 1 : 1 - Math.exp(-x);
}
export function sum(x: numberArray, order: number = 2): number {
  // iterative Kahan–Babuška algorithm
  const cs: number[] = new Array(order + 1).fill(0.0);
  for (let i = 0; i < x.length; i++) {
    let t, e;
    const c = new Array(order + 1).fill(0.0);
    c[0] = x[i];
    for (let j = 0; j < order; j++) {
      t = cs[j] + c[j];
      if (Math.abs(cs[j]) >= Math.abs(c[j])) {
        e = cs[j] - t;
        c[j + 1] = e + c[j];
      } else {
        e = c[j] - t;
        c[j + 1] = e + cs[j];
      }
      cs[j] = t;
    }
    cs[order] += c[order];
  }
  return cs.reduce((a, b) => a + b, 0);
}
export function normalize<T extends numberArray>(
  array: T,
  total: number = 1,
): T {
  const _sum = sum(array);
  if (_sum === 0) {
    console.log(array);
    throw new Error("Cannot normalize an array with sum equal to zero");
  }
  if (!Number.isFinite(_sum))
    return normalize(
      array.map((v) => (Number.isFinite(v) ? 0 : v > 0 ? +1 : -1)) as T,
      total,
    );
  return array.map((v) => (v * total) / _sum) as T;
}
export function average(x: numberArray, w: numberArray | null = null) {
  if (w === null) w = new Array(x.length).fill(1);
  w = normalize(w);
  return sum(
    x.map((v, i) => v * w[i]),
    2,
  );
}
export function maxA(x: numberArray) {
  try {
    return Math.max(...x);
  } catch {
    // for very large arrays
    let acc = -Infinity;
    for (let i = 0; i < x.length; i++) {
      if (Number.isNaN(x[i])) return NaN;
      if (!Number.isFinite(x[i]) && x[i] > 0) return Infinity;
      acc = Math.max(acc, x[i]);
    }
    return acc;
  }
}
export function minA(x: numberArray) {
  return -maxA(x.map((v) => -v));
}
export function argmax(x: numberArray) {
  const x_max = maxA(x);
  return x.indexOf(x_max);
}
export function softargmax<T extends numberArray>(x: T, temperature = 1): T {
  const x_max = maxA(x);
  if (Number.isFinite(x_max) && !Number.isNaN(x_max)) {
    const x_ = x.map((v) => v - x_max);
    if (temperature != 0) {
      const exps = x_.map((v) => Math.exp(v / temperature)) as T;
      const ret = normalize(exps);
      if (ret.every((v) => Number.isFinite(v) && !Number.isNaN(v))) return ret;
    }
    {
      const argmax = x_.map((v) => (v === 0 ? 1 : 0)) as T;
      const ret = normalize(argmax);
      if (ret.every((v) => Number.isFinite(v) && !Number.isNaN(v))) return ret;
    }
  }
  {
    const ret = x.map(() => 0) as T;
    ret[argmax(x)] = 1;
    return ret;
  }
}
export function softmax(x: numberArray, temperature = 1) {
  const argmax = softargmax(x, temperature);
  return average(x, argmax);
}
export function productRange(from: number, to: number) {
  let y = 1.0;
  for (let i = from; i <= to; i++) y *= i;
  return y;
}
export function factorial(n: number) {
  return productRange(1, n);
}
export function permutation(a: number, k: number) {
  return productRange(a - k + 1, a);
}
export function combination(a: number, k: number) {
  return permutation(a, k) / factorial(k);
}
export function gamma(n: number) {
  let reflected = false;
  if (Number.isInteger(n)) {
    if (n <= 0) return Number.isFinite(n) ? Infinity : NaN;
    if (n > 171) return Infinity;
    return factorial(n - 1);
  }
  if (n < 0.5) {
    n = 1.0 - n;
    reflected = true;
  }
  if (n > 171.35) return Infinity;
  if (n > 85.0)
    return (
      Math.sqrt((Math.PI * 2.0) / n) *
      Math.pow(n / Math.E, n) *
      (1.0 +
        1.0 / (Math.pow(n, 1) * 12) +
        1.0 / (Math.pow(n, 2) * 288) -
        139.0 / (Math.pow(n, 3) * 51840) -
        571.0 / (Math.pow(n, 4) * 2488320) +
        163879.0 / (Math.pow(n, 5) * 209018880) +
        5246819.0 / (Math.pow(n, 6) * 75246796800))
    );
  n--;
  let x = 0.99999999999999709182;
  x += 57.156235665862923517 / (n + 1);
  x += -59.597960355475491248 / (n + 2);
  x += 14.136097974741747174 / (n + 3);
  x += -0.49191381609762019978 / (n + 4);
  x += 0.33994649984811888699e-4 / (n + 5);
  x += 0.46523628927048575665e-4 / (n + 6);
  x += -0.98374475304879564677e-4 / (n + 7);
  x += 0.15808870322491248884e-3 / (n + 8);
  x += -0.21026444172410488319e-3 / (n + 9);
  x += 0.2174396181152126432e-3 / (n + 10);
  x += -0.16431810653676389022e-3 / (n + 11);
  x += 0.84418223983852743293e-4 / (n + 12);
  x += -0.2619083840158140867e-4 / (n + 13);
  x += 0.36899182659531622704e-5 / (n + 14);
  const t = n + 4.7421875 + 0.5;
  const result =
    x * Math.sqrt(Math.PI * 2) * Math.pow(t, n + 0.5) * Math.exp(-t);
  return reflected ? Math.PI / (Math.sin(-Math.PI * n) * result) : result;
}
