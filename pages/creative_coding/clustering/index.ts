import { gaussianMixtureStep } from "@/utils/algo/gmm.js";
import { kMeansStep } from "@/utils/algo/kmeans.js";
import {
  getPaletteAccentColor,
  getPaletteBaseColor,
} from "@/utils/color/palette.js";
import { startAnimationLoop } from "@/utils/dom/utils.js";
import { randomGaussian2, sample } from "@/utils/math/random.js";
import { average, map, min } from "@/utils/math/utils.js";
import { vector_add, vector_dist, vector_scale } from "@/utils/math/vector.js";

type DataPoint = [number, number];
type IClusterStep =
  typeof kMeansStep<DataPoint> | typeof gaussianMixtureStep<DataPoint>;
type ClusterMode = "kmean" | "gmm";

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let gen: ReturnType<IClusterStep> | null = null;
  let samples: DataPoint[];
  let seeds: DataPoint[];
  const getPalette = () => ({
    background: getPaletteBaseColor(0),
    data: getPaletteBaseColor(1),
    centroid: getPaletteAccentColor(6),
  });
  let active = false;
  const baseline: [[mean: DataPoint, variance: number], weight: number][] = [
    [[[1, 2], 2 / 3], 0.25],
    [[[3, 3], 1 / 3], 0.25],
    [[[8, 0], 1 / 3], 0.75],
  ];
  const x0 = -5,
    x1 = 10,
    y0 = -5,
    y1 = 10;

  function startSamp({ sample_size = 1000 }) {
    samples = new Array(sample_size).fill(0).map(() => {
      const [m, v] = sample(
        baseline.map(([c]) => c),
        baseline.map(([_, w]) => w),
      );
      return vector_add(vector_scale(randomGaussian2(), v), m);
    });
    seeds = [];
    gen = null;
    drawStep();
  }
  function startGen({
    n_cluster = baseline.length,
    mode = "kmean" as ClusterMode,
  }) {
    if (!samples) return;
    const dim = baseline[0]![0][0].length;
    gen = { kmean: kMeansStep, gmm: gaussianMixtureStep }[mode](samples, {
      n_cluster,
      seeds,
      n_sample: 0,
      copy: (v) => v.map((x) => x) as DataPoint,
      dist: vector_dist,
      average: (array, w) =>
        new Array(dim).fill(0).map((_, i) =>
          average(
            array.map((a) => a[i]!),
            w,
          ),
        ) as DataPoint,
    });
    if (!active) {
      startAnimationLoop(drawStep, 100);
    }
  }

  function drawStep() {
    if (!ctx) return (active = false);
    active = true;
    const palette = getPalette();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.lineWidth = 0;
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    samples.forEach((v) => {
      ctx.fillStyle = palette.data;
      ctx.beginPath();
      ctx.arc(
        map(v[0], x0, x1, 0, ctx.canvas.width),
        map(v[1], y0, y1, ctx.canvas.height, 0),
        1,
        0,
        2 * Math.PI,
      );
      ctx.fill();
    });
    let centroids: DataPoint[] | null = null,
      deviation: number[] | null = null;
    if (gen !== null) {
      const { done, value } = gen.next();
      if (done) {
        centroids = value;
        gen = null;
      } else {
        if ("centroids" in value) centroids = value.centroids as DataPoint[];
        if ("deviation" in value) deviation = value.deviation as number[];
        else if ("variances" in value)
          deviation = (value.variances as number[]).map(Math.sqrt);
      }
    } else {
      centroids = seeds;
    }
    if (centroids !== null && deviation === null) {
      deviation = centroids!.map((m1, i, a) =>
        min(a.filter((_, j) => j !== i).map((m2) => vector_dist(m1, m2) / 2)),
      );
    }
    if (centroids !== null) seeds = centroids;
    new Array(centroids?.length ?? 0).fill(0).forEach((_, i) => {
      if ((centroids?.[i] ?? null) === null) return;
      const m = centroids![i]!;
      ctx.fillStyle = palette.centroid;
      ctx.strokeStyle = palette.centroid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(
        map(m[0], x0, x1, 0, ctx.canvas.width),
        map(m[1], y0, y1, ctx.canvas.height, 0),
        2,
        0,
        2 * Math.PI,
      );
      ctx.fill();
      if ((deviation?.[i] ?? null) === null) return;
      const d = deviation![i]!;
      ctx.beginPath();
      ctx.ellipse(
        map(m[0], x0, x1, 0, ctx.canvas.width),
        map(m[1], y0, y1, ctx.canvas.height, 0),
        map(d, 0, Math.abs(x1 - x0), 0, ctx.canvas.width),
        map(d, 0, Math.abs(y1 - y0), 0, ctx.canvas.height),
        0,
        0,
        2 * Math.PI,
      );
      ctx.stroke();
    });
    return (active = gen !== null);
  }

  return {
    start: (sketch: HTMLCanvasElement, form: HTMLFormElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      form
        .querySelector<HTMLButtonElement>("#restart")!
        .addEventListener("click", () =>
          startSamp({
            sample_size:
              form.querySelector<HTMLInputElement>("#sample-size")
                ?.valueAsNumber ?? 1000,
          }),
        );
      form
        .querySelector<HTMLButtonElement>("#continue")!
        .addEventListener("click", () =>
          startGen({
            n_cluster:
              form.querySelector<HTMLInputElement>("#cluster-count")
                ?.valueAsNumber ?? baseline.length,
            mode:
              (form.querySelector<HTMLSelectElement>("#algorithm")
                ?.value as ClusterMode) ?? "kmean",
          }),
        );
    },
    stop: () => {
      canvas?.remove();
    },
  };
}
