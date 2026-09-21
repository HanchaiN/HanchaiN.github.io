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
    min_dist = 1e-2,
    min_dist_norm = 0.25,
    min_weight = 1e-2,
    n_cluster = 16,
    max_iter = 1000,
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
  const centroids = extendCentroids(samples, n_cluster, seeds, dist, copy);
  const weights = centroids.map((_) => 1 / centroids.length);
  const variances = centroids.map((_) => 1);
  const updateParams = (samples: T[], likelihood: number[][]) => {
    let converged = true;
    centroids.forEach((c, j) => {
      weights[j] =
        (sum(likelihood.map((l) => l[j]!)) + (prior_conc - 1)) /
        (likelihood.length + weights.length * (prior_conc - 1));
      centroids[j] = avg(
        samples,
        likelihood.map((l) => l[j]!),
      );
      variances[j] =
        reg_var +
        (samples.length > 1
          ? average(
              samples.map((s) => Math.pow(dist(s, centroids[j]!), 2)),
              likelihood.map((l) => l[j]!),
            ) *
            (samples.length / (samples.length - 1))
          : 0);
      if (dist(c, centroids[j]) / Math.sqrt(variances[j]) > min_dist_norm)
        converged = false;
    });
    return converged;
  };
  {
    const likelihood: number[][] = samples.map((s) =>
      softargmax(
        centroids.map((m) => -dist(m, s)),
        0,
      ),
    );
    updateParams(samples, likelihood);
  }
  let convergence: number = Infinity;
  for (let it = 0; it < max_iter; it++) {
    const subsamples = getSamples();
    // Expectation
    const likelihood: number[][] = subsamples.map((s) =>
      centroids.map(
        (_, j) => weights[j]! * gaussian(s, centroids[j]!, variances[j]!),
      ),
    );
    likelihood.forEach((_, i) => {
      likelihood[i] = normalizeSum(likelihood[i]!);
    });
    // Maximization
    let converged = updateParams(subsamples, likelihood);
    centroids.forEach((c, j) => {
      if (
        weights[j]! < min_weight ||
        variances[j]! < Math.pow(min_dist, 2) ||
        centroids
          .slice(0, j)
          .some(
            (c_, j_) =>
              dist(c, c_) / Math.sqrt(variances[j]! + variances[j_]!) <
              min_dist_norm,
          )
      ) {
        centroids[j] = addCentroid(
          subsamples,
          likelihood.map((l) => max(l)),
          subsamples.map((s) =>
            min(
              zip<[T, number]>(centroids, variances).map(
                ([c, v]) => dist(c, s) / Math.sqrt(v),
              ),
            ),
          ),
        );
        weights[j] = 1;
        variances[j] = 1;
        converged = false;
      }
    });
    yield { centroids, weights, variances };
    if (converged) {
      convergence = it;
      break;
    }
  }
  console.debug(convergence);
  return centroids;
}

export function gaussianMixture<T>(
  ...args: Parameters<typeof gaussianMixtureStep<T>>
) {
  return iterate_all(gaussianMixtureStep(...args));
}
