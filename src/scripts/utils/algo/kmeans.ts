import { sample } from "../math/random.js";
import { argmax, average, minA, softargmax } from "../math/utils.js";

function getSilhouetteScoreArray<T>(
  samples: T[],
  centroids: T[] = [],
  dist: (a: T, b: T) => number,
  simplify_a: boolean = false,
  simplify_b: boolean = false,
): [number, number][] {
  const ind = samples.map((v) => {
    let min_dist = Infinity,
      min_ind: number[] = [];
    for (let j = 0; j < centroids.length; j++) {
      const d = dist(v, centroids[j]);
      if (d < min_dist) {
        min_dist = d;
        min_ind = [j];
      } else if (d === min_dist) {
        min_ind.push(j);
      }
    }
    return min_ind[Math.floor(Math.random() * min_ind.length)];
  });
  const cls = new Array(centroids.length)
    .fill(0)
    .map((_, k) =>
      samples.map((c, i) => ({ c, i })).filter(({ i }) => ind[i] === k),
    );
  const _dist: Map<string, number> = new Map();
  const dist_samp_samp = (i: number, j: number) => {
    if (i === j) return 0;
    if (i > j) [i, j] = [j, i];
    const key = `S_${i}_${j}`;
    if (!_dist.has(key)) _dist.set(key, dist(samples[i], samples[j]));
    const val = _dist.get(key);
    if (typeof val === "undefined") throw new Error("Unreachable");
    return val!;
  };
  const dist_samp_cen = (i: number, j: number) => {
    const key = `C_${i}_${j}`;
    if (!_dist.has(key)) _dist.set(key, dist(samples[i], centroids[j]));
    const val = _dist.get(key);
    if (typeof val === "undefined") throw new Error("Unreachable");
    return val!;
  };

  const a = samples.map((_, i) => {
    return cls[ind[i]].length <= 1
      ? 0
      : simplify_a
        ? dist_samp_cen(i, ind[i])
        : average(
            cls[ind[i]]
              .filter(({ i: j }) => j !== ind[i])
              .map(({ i: j }) => dist_samp_samp(i, j)),
          );
  });
  const b = samples.map((_, i) => {
    let min_dist = Infinity;
    for (let k = 0; k < centroids.length; k++) {
      if (cls[k].length <= 0) continue;
      if (k === ind[i]) continue;
      const d = simplify_b
        ? dist_samp_cen(i, k)
        : average(cls[k].map(({ i: j }) => dist_samp_samp(i, j)));
      if (d < min_dist) {
        min_dist = d;
      }
    }
    return min_dist;
  });
  const s = samples.map((_, i) => {
    const max = Math.max(a[i], b[i]);
    return cls[ind[i]].length <= 1 || Number.isNaN(a[i]) || Number.isNaN(b[i])
      ? 0
      : !Number.isFinite(a[i])
        ? -1
        : !Number.isFinite(b[i])
          ? 1
          : max === 0
            ? 0
            : (b[i] - a[i]) / max;
  });
  return cls.map((v) =>
    v.length === 0 ? [-1, 0] : [average(v.map(({ i }) => s[i])), v.length],
  );
}

export function getSilhouetteScore<T>(
  samples: T[],
  centroids: T[] = [],
  dist: (a: T, b: T) => number,
  simplify_a: boolean = false,
  simplify_b: boolean = false,
) {
  const score = getSilhouetteScoreArray(
    samples,
    centroids,
    dist,
    simplify_a,
    simplify_b,
  );
  return average(
    score.map(([s]) => s),
    score.map(([, n]) => n),
  );
}

function addCentroid<T>(
  samples: T[],
  seeds: T[] = [],
  dist: (a: T, b: T) => number = () => 0,
) {
  // K-means++ initialization
  const weight = softargmax(
    samples.map((v) => minA(seeds.map((c) => dist(v, c)))),
    0.1,
  );
  return sample(samples, weight);
}

function removeCentroid<T>(
  samples: T[],
  seeds: T[] = [],
  dist: (a: T, b: T) => number = () => 0,
) {
  if (seeds.length === 0) return null;
  const weight = softargmax(
    seeds.map((v, i) =>
      minA(seeds.filter((_, j) => i !== j).map((c) => dist(v, c))),
    ),
    -0.1,
  );
  return sample(seeds, weight);
}

export function extendCentroids<T>(
  samples: T[] | (() => T[]),
  n = 16,
  seeds: T[] = [],
  dist: (a: T, b: T) => number = () => 0,
  copy: (v: T) => T = (v) => v,
) {
  if (n === 0) return [];
  const getSample = typeof samples === "function" ? samples : () => samples;
  const centroids: T[] = seeds.map((v) => copy(v));
  while (centroids.length > n) {
    const c = removeCentroid(getSample(), centroids, dist);
    if (c !== null) centroids.splice(centroids.indexOf(c), 1);
  }
  while (centroids.length < n) {
    const c = addCentroid(getSample(), centroids, dist);
    if (c !== null) centroids.push(copy(c));
  }
  return centroids;
}

export function kMeans<T>(
  samples: T[],
  N_SAMPLE: number = 1000,
  n = 16,
  max_iter = 1000,
  seeds: T[] = [],
  copy: (v: T) => T = (v) => v,
  dist: (a: T, b: T) => number = () => 0,
  average: (a: T[], w: number[]) => T = (a, w) => a[argmax(w)],
) {
  const getSample = (n = N_SAMPLE) =>
    samples
      .filter(() => Math.random() < n / samples.length)
      .sort(() => Math.random() - 0.5);
  const centroids = extendCentroids(samples, n, seeds, dist, copy);
  // K-means clustering
  for (let _ = 0; _ < max_iter; _++) {
    const acc: T[][] = new Array(centroids.length).fill(0).map(() => []);
    const sample = getSample();
    for (let k = 0; k < sample.length; k++) {
      let min_dist = Infinity;
      let min_index: number[] = [];
      for (let j = 0; j < centroids.length; j++) {
        const d = dist(sample[k], centroids[j]);
        if (d < min_dist) {
          min_dist = d;
          min_index = [j];
        } else if (d === min_dist) {
          min_index.push(j);
        }
      }
      acc[min_index[Math.floor(Math.random() * min_index.length)]].push(
        sample[k],
      );
    }
    let converged = true;
    for (let j = 0; j < centroids.length; j++) {
      if (acc[j].length === 0) {
        centroids[j] = addCentroid(getSample(), centroids, dist);
        converged = false;
      } else {
        const c_ = average(
          acc[j],
          acc[j].map(() => 1 / acc[j].length),
        );
        if (dist(c_, centroids[j]) > 1e-6) converged = false;
        centroids[j] = c_;
      }
    }
    if (converged) break;
  }
  return centroids;
}
