import {
  combination,
  factorial,
  permutation,
  product,
} from "@/scripts/utils/math/utils.js";
import {
  TComplex,
  complex_absSq,
  complex_add,
  complex_conj,
  complex_div,
  complex_exp,
  complex_mult,
  complex_pow,
  complex_scale,
} from "@/scripts/utils/math/complex.js";
import {
  TCVector3,
  TVector3,
  vector_alzimuth,
  vector_fromSphere,
  vector_inclination,
} from "@/scripts/utils/math/vector.js";
export const RADIUS_REDUCED = 1.0;
export const MASS_REDUCED = 9.109e-31;
export const H_BAR = 1.054e-34;
export const Z = 1.0;
const SAMPLE_RESOLUTION = 0.25;

function laguerre(n: number, k: number, x: number) {
  let y = 0.0;
  for (let i = 0; i <= n; i++) {
    y *= -x;
    y += combination(n + k, i) / factorial(n - i);
  }
  return y;
}
function laguerre_der(n: number, k: number, x: number, order = 1) {
  if (order > n) return 0;
  const factor = Math.pow(-1, order);
  return factor * laguerre(n - order, k + order, x);
}
function legendre(m: number, l: number, x: number) {
  const f1 = 1.0;
  if (Math.abs(m) > l) return 0;
  if (l < 0) l = -l - 1;
  let factor = 1.0;
  if (m < 0) {
    factor *= Math.pow(-1, m) * product(l - m + 1, l + m);
    m = -m;
  }
  factor *= Math.pow(-1, m) * Math.pow(2, l);
  let y = 0.0;
  for (let i = 0; i <= l - m; i++) {
    y *= x;
    y +=
      combination(f1 * l, l - i) *
      combination((f1 * 2 * l - i - 1) / 2, l) *
      permutation(l - i, m);
  }
  return y * factor * Math.pow(1 - x * x, (f1 * m) / 2);
}
function legendre_der(m: number, l: number, x: number, order = 1) {
  if (order === 0) return legendre(m, l, x);
  if (order === 1) {
    return (
      (-(l + 1) * x * legendre(m, l, x) + (l - m + 1) * legendre(m, l + 1, x)) /
      (Math.pow(x, 2) - 1)
    );
  }
  throw new Error();
}
function sph_harm(m: number, l: number, theta: number, phi: number) {
  const f1 = 1.0;
  let factor = 1.0;
  let reflected = false;
  if (m < 0) {
    reflected = true;
    factor *= Math.pow(-1, m);
    m = -m;
  }
  factor *=
    Math.pow(-1, m) *
    Math.sqrt((f1 * 2 * l + 1) / (4 * Math.PI * product(l - m + 1, l + m)));
  const c = legendre(m, l, Math.cos(theta));
  const result = complex_scale(complex_exp([0, phi * m]), factor * c);
  return reflected ? complex_conj(result) : result;
}
function sph_harm_der(
  m: number,
  l: number,
  theta: number,
  phi: number,
  order_theta = 0,
  order_phi = 0,
): TComplex {
  if (m < 0)
    return complex_conj(
      complex_scale(
        sph_harm_der(-m, l, theta, phi, order_theta, order_phi),
        Math.pow(-1, -m),
      ),
    );
  if (order_phi !== 0)
    return complex_mult(
      sph_harm_der(m, l, theta, phi, order_theta, 0),
      complex_pow([0, m], [order_phi, 0]),
    );
  if (order_theta === 0) return sph_harm(m, l, theta, phi);
  if (order_theta === 1)
    return complex_scale(
      complex_exp([0, m * phi]),
      -Math.pow(-1, m) *
        Math.sqrt((2 * l + 1) / (4 * Math.PI) / product(l - m + 1, l + m)) *
        legendre_der(m, l, Math.cos(theta), order_theta) *
        Math.sin(theta),
    );
  throw new Error();
}
export function psi_orbital(
  n: number,
  l: number,
  m: number,
  x: TVector3,
  t: number,
) {
  const normalize_r = Math.sqrt(
    Math.pow((2 * Z) / (n * RADIUS_REDUCED), 3.0) /
      (product(n - l, n + l) * 2 * n),
  );
  const r = Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]); // vector_mag(x);
  const theta = vector_inclination(x);
  const phi = vector_alzimuth(x);
  const rho = ((2 * Z) / (n * RADIUS_REDUCED)) * r;
  const tau =
    (-(Z * Z * H_BAR * H_BAR) /
      (2 * MASS_REDUCED * RADIUS_REDUCED * RADIUS_REDUCED * n * n) /
      H_BAR) *
    t;
  const _radial =
    normalize_r *
    Math.exp(-rho / 2) *
    Math.pow(rho, l) *
    laguerre(n - l - 1, 2 * l + 1, rho);
  const _angular = sph_harm(m, l, theta, phi);
  const _temporal = complex_exp([0, -tau]);
  return complex_scale(complex_mult(_angular, _temporal), _radial);
}
export function psi_orbital_der(
  n: number,
  l: number,
  m: number,
  x: TVector3,
  t: number,
): TCVector3 {
  const normalize_r = Math.sqrt(
    Math.pow((2 * Z) / (n * RADIUS_REDUCED), 3.0) /
      (product(n - l, n + l) * 2 * n),
  );
  const factor_r = (2 * Z) / (n * RADIUS_REDUCED);
  const r = Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]); // vector_mag(x);
  const theta = vector_inclination(x);
  const phi = vector_alzimuth(x);
  const rho = factor_r * r;
  const tau =
    (-(Z * Z * H_BAR * H_BAR) /
      (2 * MASS_REDUCED * RADIUS_REDUCED * RADIUS_REDUCED * n * n) /
      H_BAR) *
    t;
  const _radial =
    normalize_r *
    Math.exp(-rho / 2) *
    Math.pow(rho, l) *
    laguerre(n - l - 1, 2 * l + 1, rho);
  const _angular = sph_harm(m, l, theta, phi);
  const _temporal = complex_exp([0, -tau]);
  const _radial_r =
    factor_r *
    normalize_r *
    ((-1 / 2) *
      Math.exp(-rho / 2) *
      Math.pow(rho, l) *
      laguerre(n - l - 1, 2 * l + 1, rho) +
      Math.exp(-rho / 2) *
        l *
        Math.pow(rho, l - 1) *
        laguerre(n - l - 1, 2 * l + 1, rho) +
      Math.exp(-rho / 2) *
        Math.pow(rho, l) *
        laguerre_der(n - l - 1, 2 * l + 1, rho, 1));
  const _angular_theta = sph_harm_der(m, l, theta, phi, 1, 0);
  const _angular_phi = sph_harm_der(m, l, theta, phi, 0, 1);
  const d_dr = complex_scale(complex_mult(_angular, _temporal), _radial_r),
    d_dtheta = complex_scale(complex_mult(_angular_theta, _temporal), _radial),
    d_dphi = complex_scale(complex_mult(_angular_phi, _temporal), _radial),
    d_dx = complex_add(
      complex_scale(d_dr, +Math.sin(theta) * Math.cos(phi)),
      complex_add(
        complex_scale(d_dtheta, (+Math.cos(theta) * Math.cos(phi)) / r),
        complex_scale(d_dphi, -Math.sin(phi) / (r * Math.sin(theta))),
      ),
    ),
    d_dy = complex_add(
      complex_scale(d_dr, +Math.sin(theta) * Math.sin(phi)),
      complex_add(
        complex_scale(d_dtheta, (+Math.cos(theta) * Math.sin(phi)) / r),
        complex_scale(d_dphi, +Math.cos(phi) / (r * Math.sin(theta))),
      ),
    ),
    d_dz = complex_add(
      complex_scale(d_dr, +Math.cos(theta)),
      complex_scale(d_dtheta, -Math.sin(theta) / r),
    );
  return [d_dx, d_dy, d_dz];
}
export function psi_orbital_sample(
  n: number,
  l: number,
  m: number,
  time: number = 0, // eslint-disable-line @typescript-eslint/no-unused-vars
  counts: number = 1,
) {
  const radial = ((counts) => {
    const MAX_SEED = 0.99;
    const normalize_r = Math.sqrt(
      Math.pow((2 * Z) / (n * RADIUS_REDUCED), 3.0) /
        (product(n - l, n + l) * 2 * n),
    );
    const _r_max = RADIUS_REDUCED * Math.pow(n + 5, 2);
    const seed = new Array(counts)
      .fill(null)
      .map(() => Math.random() * MAX_SEED);
    const res: number[] = new Array(counts).fill(null);
    let total_prob = 0;
    for (let r = SAMPLE_RESOLUTION / 2; r < _r_max; r += SAMPLE_RESOLUTION) {
      const rho = ((2 * Z) / (n * RADIUS_REDUCED)) * r;
      const psi =
        normalize_r *
        Math.exp(-rho / 2) *
        Math.pow(rho, l) *
        laguerre(n - l - 1, 2 * l + 1, rho);
      const density = psi * psi;
      const probability = density * SAMPLE_RESOLUTION * r * r;
      total_prob += probability;
      if (
        seed.reduce((acc, v, i) => {
          if (res[i] === null && total_prob > v) res[i] = r;
          if (res[i] === null) return false;
          return acc;
        }, true)
      )
        return res;
    }
    console.warn(
      `Total radial probability is not 1. Please update max_seed to ${total_prob}.`,
    );
    return res;
  })(counts);
  const angular = ((counts) => {
    const MAX_SEED = 1;
    const seed = new Array(counts)
      .fill(null)
      .map(() => Math.random() * MAX_SEED);
    const res: { theta: number; phi: number }[] = new Array(counts).fill(null);
    let total_prob = 0;
    const d_theta = Math.PI / 180; // Math.PI / Math.round(Math.PI / SAMPLE_RESOLUTION / r)
    for (let theta = 0; theta <= Math.PI; theta += d_theta) {
      const d_phi = Math.PI / 360; // 2 * Math.PI / Math.round(2 * Math.PI / SAMPLE_RESOLUTION / (r * Math.abs(Math.cos(theta))))
      const factor = Math.sin(theta) * d_theta * d_phi;
      for (let phi = 0; phi < 2 * Math.PI; phi += d_phi) {
        const psi = sph_harm(m, l, theta, phi);
        const density = complex_absSq(psi);
        const probability = density * factor;
        total_prob += probability;
        if (
          seed.reduce((acc, v, i) => {
            if (res[i] === null && total_prob > v) res[i] = { theta, phi };
            if (res[i] === null) return false;
            return acc;
          }, true)
        )
          return res;
      }
    }
    console.warn(
      `Total angular probability is not 1. Please update max_seed to ${total_prob}.`,
    );
    return res;
  })(counts);
  return new Array(counts)
    .fill(null)
    .map((_, i) =>
      vector_fromSphere(radial[i], angular[i].theta, angular[i].phi),
    );
}

export function psi_orbital_superposition(
  state: { c: TComplex; n: number; l: number; m: number }[],
  x: TVector3,
  t: number,
) {
  const total_mag = Math.sqrt(
    state.reduce((prev, { c }) => prev + complex_absSq(c), 0),
  );
  const normalization = total_mag === 0 ? 0 : 1 / total_mag;
  if (total_mag === 0) console.warn("Total magnitute is zero");
  const v = state.reduce<TComplex>(
    (prev, { c, n, l, m }) =>
      complex_add(
        prev,
        complex_mult(
          complex_scale(c, normalization),
          psi_orbital(n, l, m, x, t),
        ),
      ),
    [0, 0],
  );
  return v;
}
export function psi_orbital_superposition_der(
  state: { c: TComplex; n: number; l: number; m: number }[],
  x: TVector3,
  t: number,
): TCVector3 {
  const total_mag = Math.sqrt(
    state.reduce((prev, { c }) => prev + complex_absSq(c), 0),
  );
  const normalization = total_mag === 0 ? 0 : 1 / total_mag;
  return state.reduce(
    ([dx, dy, dz], { c, n, l, m }) => {
      const der = psi_orbital_der(n, l, m, x, t);
      return [
        complex_add(dx, complex_mult(complex_scale(c, normalization), der[0])),
        complex_add(dy, complex_mult(complex_scale(c, normalization), der[1])),
        complex_add(dz, complex_mult(complex_scale(c, normalization), der[2])),
      ];
    },
    [
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  );
}
export function psi_orbital_superposition_sample(
  state: { c: TComplex; n: number; l: number; m: number }[],
  time: number = 0,
  counts: number = 1,
) {
  const MAX_SEED = 0.99;
  const R_MAX = 50;
  const seed = new Array(counts).fill(null).map(() => Math.random() * MAX_SEED);
  const res: TVector3[] = new Array(counts).fill(null);
  let total_prob = 0;
  const d_r = SAMPLE_RESOLUTION;
  for (let r = SAMPLE_RESOLUTION / 2; r < R_MAX; r += d_r) {
    const d_theta = (10 * Math.PI) / 180; // Math.PI / Math.round(Math.PI / SAMPLE_RESOLUTION / r)
    for (let theta = 0; theta <= Math.PI; theta += d_theta) {
      const d_phi = (10 * Math.PI) / 360; // 2 * Math.PI / Math.round(2 * Math.PI / SAMPLE_RESOLUTION / (r * Math.abs(Math.cos(theta))))
      const factor = r * r * Math.sin(theta) * d_r * d_theta * d_phi;
      for (let phi = 0; phi < 2 * Math.PI; phi += d_phi) {
        const pos = vector_fromSphere(
          r + (Math.random() - 0.5) * d_r,
          theta + (Math.random() - 0.5) * d_theta,
          phi + (Math.random() - 0.5) * d_phi,
        );
        const psi = psi_orbital_superposition(state, pos, time);
        const density = complex_absSq(psi);
        const probability = density * factor;
        total_prob += probability;
        if (
          seed.reduce((acc, v, i) => {
            if (res[i] !== null) return acc;
            if (total_prob <= v) return false;
            res[i] = pos;
            return acc;
          }, true)
        )
          return res;
      }
    }
  }
  console.warn(
    `Total probability is not 1. Please update max_seed to ${total_prob}.`,
  );
  return res;
}

export function psi_orbital_re(
  n: number,
  l: number,
  m: number,
): { c: TComplex; n: number; l: number; m: number }[] {
  if (m > 0)
    return [
      { c: complex_exp([0, 0]), n, l, m: -m },
      { c: complex_exp([0, m * Math.PI]), n, l, m: +m },
    ];
  if (m < 0)
    return [
      { c: complex_exp([0, Math.PI / 2]), n, l, m: +m },
      { c: complex_exp([0, (m - 1 / 2) * Math.PI]), n, l, m: -m },
    ];
  return [{ c: [1, 0], n, l, m }];
}

export function psi_getvel(val: TComplex, der: TCVector3): TVector3 {
  if (complex_absSq(val) === 0) return [0, 0, 0];
  return der.map<number>(
    (z) => (complex_div(z, val)[1] * H_BAR) / MASS_REDUCED,
  ) as TVector3;
}
