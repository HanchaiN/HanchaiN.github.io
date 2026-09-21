import { sample } from "../math/random.js";
import { argmax, average, min, softargmax, sum } from "../math/utils.js";
import { iterate_all } from "../utils.js";

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
    centroids.forEach((centroid, j) => {
      const d = dist(v, centroid);
      if (d < min_dist) {
        min_dist = d;
        min_ind = [j];
      } else if (d === min_dist) {
        min_ind.push(j);
      }
    });
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
    if (!_dist.has(key)) _dist.set(key, dist(samples[i]!, samples[j]!));
    const val = _dist.get(key);
    if (typeof val === "undefined") throw new Error("Unreachable");
    return val!;
  };
  const dist_samp_cen = (i: number, j: number) => {
    const key = `C_${i}_${j}`;
    if (!_dist.has(key)) _dist.set(key, dist(samples[i]!, centroids[j]!));
    const val = _dist.get(key);
    if (typeof val === "undefined") throw new Error("Unreachable");
    return val!;
  };

  const a = samples.map((_, i) => {
    return cls[ind[i]!]!.length <= 1
      ? 0
      : simplify_a
        ? dist_samp_cen(i, ind[i]!)
        : average(
            cls[ind[i]!]!.filter(({ i: j }) => j !== ind[i]).map(({ i: j }) =>
              dist_samp_samp(i, j),
            ),
          );
  });
  const b = samples.map((_, i) => {
    let min_dist = Infinity;
    for (let k = 0; k < centroids.length; k++) {
      if (cls[k]!.length <= 0) continue;
      if (k === ind[i]) continue;
      const d = simplify_b
        ? dist_samp_cen(i, k)
        : average(cls[k]!.map(({ i: j }) => dist_samp_samp(i, j)));
      if (d < min_dist) {
        min_dist = d;
      }
    }
    return min_dist;
  });
  const s = samples.map((_, i) => {
    const max = Math.max(a[i]!, b[i]!);
    return cls[ind[i]!]!.length <= 1 || Number.isNaN(a[i]) || Number.isNaN(b[i])
      ? 0
      : !Number.isFinite(a[i])
        ? -1
        : !Number.isFinite(b[i])
          ? 1
          : max === 0
            ? 0
            : (b[i]! - a[i]!) / max;
  });
  return cls.map((v) =>
    v.length === 0 ? [-1, 0] : [average(v.map(({ i }) => s[i]!)), v.length],
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

function addCentroid<T>(samples: T[], distance: number[]) {
  // K-means++ initialization
  const weight = softargmax(distance, 0.1);
  return sample(samples, weight);
}

function removeCentroid<T>(
  _: T[],
  seeds: T[] = [],
  dist: (a: T, b: T) => number = () => 0,
) {
  if (seeds.length === 0) return null;
  const weight = softargmax(
    seeds.map((v, i) =>
      min(seeds.filter((_, j) => i !== j).map((c) => dist(v, c))),
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
    const subsamples = getSample();
    const c = addCentroid(
      subsamples,
      subsamples.map((v) => min(seeds.map((c) => dist(v, c)))),
    );
    if (c !== null) centroids.push(copy(c));
  }
  return centroids;
}

export function* kMeansStep<T>(
  samples: T[],
  {
    n_sample = 1000,
    decay_rate = 0.05,
    n_cluster = 16,
    min_dist = 1e-5,
    max_iter = 1000,
    seeds = null as T[] | null,
    copy = (v: T) => v,
    dist = (_a: T, _b: T) => 0 as number,
    average: avg = (array: T[], w: number[]) => array[argmax(w)] as T,
  } = {},
) {
  if (seeds === null) seeds = [];
  const getSample = (n = n_sample) =>
    samples
      .filter(() => n <= 0 || Math.random() < n / samples.length)
      .sort(() => Math.random() - 0.5);
  const clusters = extendCentroids(samples, n_cluster, seeds, dist, copy).map(
    (c) => ({
      centroid: c,

      acc_weight: 0,
    }),
  );
  const total = {
    acc_weight: 0,
    acc_scale: 0,
  };
  const updateParams = (member_list: T[][]) => {
    let converged = true;
    const total_weight = sum(member_list.map((list) => list.length)); // samples.length;
    total.acc_weight += total_weight;
    total.acc_scale += 1;
    clusters.forEach((cluster, j) => {
      const c = cluster.centroid;
      const members = member_list[j]!;
      if (members.length === 0) {
        converged = false;
        return;
      }

      const local_weight = members.length;
      const local_centroid = avg(
        members,
        members.map(() => 1),
      );
      cluster.centroid = avg(
        [cluster.centroid, local_centroid],
        [cluster.acc_weight, local_weight],
      );

      cluster.acc_weight + local_weight;
      if (dist(c, cluster.centroid) > min_dist) converged = false;
      cluster.acc_weight *= Math.max(0, 1 - decay_rate);
    });
    total.acc_weight *= Math.max(0, 1 - decay_rate);
    total.acc_scale *= Math.max(0, 1 - decay_rate);
    return converged;
  };
  // K-means clustering
  let convergence: number = Infinity;
  for (let it = 0; it < max_iter; it++) {
    const member_list: T[][] = new Array(clusters.length).fill(0).map(() => []);
    const subsamples = getSample();
    // Expectation
    subsamples.forEach((s) => {
      sample(
        member_list,
        softargmax(
          clusters.map((cluster) => -dist(s, cluster.centroid)),
          0,
        ),
      ).push(s);
    });
    // Maximization
    let converged = updateParams(member_list);
    // Constraint
    clusters.forEach((cluster, j) => {
      if (member_list[j]!.length === 0) {
        cluster.centroid = addCentroid(
          getSample(),
          subsamples.map((s) =>
            min(clusters.map(({ centroid }) => dist(centroid, s))),
          ),
        );
        converged = false;
      }
    });
    yield { centroids: clusters.map(({ centroid }) => centroid) };
    if (converged && it > 1) {
      convergence = it;
      break;
    }
  }
  console.debug(convergence);
  return clusters.map(({ centroid }) => centroid);
}

export function kMeans<T>(...args: Parameters<typeof kMeansStep<T>>) {
  return iterate_all(kMeansStep(...args));
}
