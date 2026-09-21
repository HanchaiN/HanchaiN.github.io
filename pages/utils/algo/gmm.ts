import { sample } from "../math/random.js";
import {
  argmax,
  max,
  min,
  normalizeSum,
  softargmax,
  sum,
  average,
} from "../math/utils.js";
import { iterate_all, zip } from "../utils.js";
import { extendCentroids } from "./kmeans.js";

function addCentroid<T>(
  samples: T[],
  likelihood: number[],
  distance: number[],
) {
  // Least certain data + Furthest data
  const weight = zip<[number, number]>(
    softargmax(
      likelihood.map((l) => -l),
      0.1,
    ),
    softargmax(
      distance.map((d) => d),
      0.1,
    ),
  ).map(([wl, wd]) => wl * wd);
  return sample(samples, weight);
}

export function* gaussianMixtureStep<T>(
  samples: T[],
  {
    n_sample = 1000,
    prior_conc = 5,
    reg_var = 1e-2,
    decay_rate = 0.05,
    min_dist = 1e-2,
    min_dist_norm = 0.05,
    min_weight = 1e-2,
    n_cluster = 16,
    max_iter = 100,
    seeds = null as T[] | null,
    copy = (v: T) => v,
    dist = (_a: T, _b: T) => 0 as number,
    average: avg = (array: T[], w: number[]) => array[argmax(w)] as T,
  } = {},
) {
  if (seeds === null) seeds = [];
  const getSamples = (n = n_sample) =>
    samples
      .filter(() => n <= 0 || Math.random() < n / samples.length)
      .sort(() => Math.random() - 0.5);
  const gaussian = (x: T, m: T, v: number) =>
    Math.exp(-Math.pow(dist(m, x), 2) / (2 * v));
  const clusters = extendCentroids(samples, n_cluster, seeds, dist, copy).map(
    (c, _, centroids) => ({
      centroid: c,
      weight: 1 / centroids.length,
      _variance: 1,
      variance: 1,

      acc_likelihood: 0,
    }),
  );
  const total = {
    acc_likelihood: 0,
    acc_scale: 0,
  };
  const updateParams = (samples: T[], likelihood: number[][]) => {
    let converged = true;
    const total_likelihood = sum(likelihood.flat()); // samples.length;
    total.acc_likelihood += total_likelihood;
    total.acc_scale += 1;
    clusters.forEach((cluster, j, clusters) => {
      const c = cluster.centroid,
        v = cluster.variance,
        w = cluster.weight;

      const local_likelihood = sum(likelihood.map((l) => l[j]!));
      const local_centroid = avg(
        samples,
        likelihood.map((l) => l[j]!),
      );
      cluster.centroid = avg(
        [cluster.centroid, local_centroid],
        [cluster.acc_likelihood, local_likelihood],
      );
      const local_variance = average(
        samples.map((s) => Math.pow(dist(s, cluster.centroid), 2)),
        likelihood.map((l) => l[j]!),
      );
      cluster._variance = average(
        [cluster._variance, local_variance],
        [cluster.acc_likelihood, local_likelihood],
      );

      cluster.acc_likelihood += local_likelihood;
      cluster.weight =
        (cluster.acc_likelihood / total.acc_scale + (prior_conc - 1)) /
        (total.acc_likelihood / total.acc_scale +
          clusters.length * (prior_conc - 1));
      cluster.variance =
        reg_var +
        cluster._variance *
          (total.acc_likelihood > 1
            ? total.acc_likelihood / (total.acc_likelihood - 1)
            : 1);

      if (
        dist(c, cluster.centroid) > min_dist ||
        dist(c, cluster.centroid) / Math.sqrt(cluster.variance) >
          min_dist_norm ||
        Math.abs(v - cluster.variance) > Math.pow(min_dist, 2) ||
        Math.abs(w - cluster.weight) / w > min_weight
      )
        converged = false;
      cluster.acc_likelihood *= Math.max(0, 1 - decay_rate);
    });
    total.acc_likelihood *= Math.max(0, 1 - decay_rate);
    total.acc_scale *= Math.max(0, 1 - decay_rate);
    return converged;
  };
  {
    const likelihood: number[][] = samples.map((s) =>
      softargmax(
        clusters.map(({ centroid }) => -dist(centroid, s)),
        0,
      ),
    );
    updateParams(samples, likelihood);
    total.acc_likelihood = 0;
    clusters.forEach((cluster) => (cluster.acc_likelihood = 0));
  }
  let convergence: number = Infinity;
  for (let it = 0; it < max_iter; it++) {
    const subsamples = getSamples();
    // Expectation
    const likelihood: number[][] = subsamples.map((s) =>
      clusters.map(
        (cluster) =>
          cluster.weight! * gaussian(s, cluster.centroid, cluster.variance),
      ),
    );
    likelihood.forEach((_, i) => {
      likelihood[i] = normalizeSum(likelihood[i]!);
    });
    // Maximization
    let converged = updateParams(subsamples, likelihood);
    // Constraint
    clusters.forEach((cluster, j) => {
      if (
        cluster.weight < min_weight ||
        cluster.variance < Math.pow(min_dist, 2) ||
        clusters
          .slice(0, j)
          .some(
            (cluster_) =>
              dist(cluster.centroid, cluster_.centroid) /
                Math.sqrt(cluster.variance + cluster_.variance) <
              min_dist_norm,
          )
      ) {
        cluster.centroid = addCentroid(
          subsamples,
          likelihood.map((l) => max(l)),
          subsamples.map((s) =>
            min(
              clusters.map(
                ({ centroid, variance }) =>
                  dist(centroid, s) / Math.sqrt(variance),
              ),
            ),
          ),
        );
        cluster.weight = 1;
        cluster._variance = 1;
        cluster.variance = 1;
        converged = false;
      }
    });
    yield {
      centroids: clusters.map(({ centroid }) => centroid),
      weights: clusters.map(({ weight }) => weight),
      variances: clusters.map(({ variance }) => variance),
    };
    if (converged && it > 1) {
      convergence = it;
      break;
    }
  }
  console.debug(convergence);
  return clusters.map(({ centroid }) => centroid);
}

export function gaussianMixture<T>(
  ...args: Parameters<typeof gaussianMixtureStep<T>>
) {
  return iterate_all(gaussianMixtureStep(...args));
}
