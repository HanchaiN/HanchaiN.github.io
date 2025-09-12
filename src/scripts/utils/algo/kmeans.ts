import { sample } from "@/scripts/utils/math/random.js";
import { argmax, softargmax } from "@/scripts/utils/math/utils.js";

function getSilhouetteScoreArray<T>(
  samples: T[],
  centroids: T[] = [],
  dist: (a: T, b: T) => number,
): [number, number][] {
  const ind = samples.map((v) => {
    let min_dist = Infinity,
      min_ind = -1;
    for (let j = 0; j < centroids.length; j++) {
      const d = dist(v, centroids[j]);
      if (d < min_dist) {
        min_dist = d;
        min_ind = j;
      }
    }
    return min_ind;
  });
  const cls = new Array(centroids.length)
    .fill(0)
    .map((_, i) =>
      samples.map((c, i) => ({ c, i })).filter((_, j) => ind[j] === i),
    );
  const a = samples.map((v, i) => {
    if (cls[ind[i]].length <= 1) return Infinity;
    return (
      cls[ind[i]].reduce((acc, { c: o }) => acc + dist(v, o), 0) /
      (cls[ind[i]].length - 1)
    );
  });
  const b = samples.map((v, i) => {
    let min_dist = Infinity;
    for (let j = 0; j < centroids.length; j++) {
      if (cls[j].length <= 0) continue;
      if (j === ind[i]) continue;
      const d =
        cls[j].reduce((acc, { c: o }) => acc + dist(v, o), 0) /
        cls[ind[i]].length;
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
    v.length === 0
      ? [-1, 0]
      : [v.reduce((acc, { i }) => acc + s[i], 0) / v.length, v.length],
  );
}

export function getSilhouetteScore<T>(
  samples: T[],
  centroids: T[] = [],
  dist: (a: T, b: T) => number,
) {
  const score = getSilhouetteScoreArray(samples, centroids, dist);
  return (
    score.reduce((acc, [s, n]) => acc + s * n, 0) /
    score.reduce((acc, [, n]) => acc + n, 0)
  );
}

function addCentroid<T>(
  samples: T[],
  seeds: T[] = [],
  dist: (a: T, b: T) => number = () => 0,
) {
  // K-means++ initialization
  const weight = softargmax(
    samples.map((v) => Math.min(Infinity, ...seeds.map((c) => dist(v, c)))),
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
      Math.min(
        Infinity,
        ...seeds.map((c, j) => (i === j ? Infinity : dist(v, c))),
      ),
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
      let min_index = -1;
      for (let j = 0; j < centroids.length; j++) {
        const d = dist(sample[k], centroids[j]);
        if (d < min_dist) {
          min_dist = d;
          min_index = j;
        }
      }
      acc[min_index].push(sample[k]);
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
