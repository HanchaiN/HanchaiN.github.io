import { PaletteInput } from "@/scripts/utils/dom/element/PaletteInput.js";
import { getImageData, onImageChange } from "@/scripts/utils/dom/image.js";
import { sample } from "@/scripts/utils/math/random.js";
import { softargmax } from "@/scripts/utils/math/utils.js";
import convert_color from "@/scripts/utils/color/conversion.js";
import type { XYZColor } from "@/scripts/utils/color/conversion.js";
import {
  extendCentroids,
  getSilhouetteScore,
  kMeans,
} from "@/scripts/utils/algo/kmeans.js";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { vector_dist } from "@/scripts/utils/math/vector.js";
import type { TVector3 } from "@/scripts/utils/math/vector.js";
import { applyColorMapping } from "../color_grading/pipeline.js";
import { _applyClosest } from "../clut_generation/pipeline.js";

const str2xyz = convert_color("str", "xyz")!,
  xyz2hex = convert_color("xyz", "hex")!,
  srgb2xyz = convert_color("srgb", "xyz")!,
  xyz2srgb = convert_color("xyz", "srgb")!;

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let palette: PaletteInput;
  const getBackground = () => getPaletteBaseColor(0);
  let isActive = false;
  let isAuto = false;
  let image: HTMLImageElement;
  let form: HTMLFormElement;
  let cache: { [n: number]: XYZColor[] } = {};
  const getPalette = () => palette.value.map((c) => str2xyz(c));
  const setPalette = (cs: XYZColor[]) => {
    palette.value = cs.map((c) => xyz2hex(c));
  };

  function setup() {
    if (!canvas) return;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function clear(img: HTMLImageElement) {
    if (!isActive) return;
    image = img;
    cache = {};
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    setPalette([]);
    redraw(true);
  }
  function getSamples() {
    const sample_dim =
      form.querySelector<HTMLInputElement>("#sample-dim")!.valueAsNumber;
    const scale = Math.max(
      1,
      Math.max(canvas.width, canvas.height) / sample_dim,
    );
    const offscreen = new OffscreenCanvas(
        canvas.width / scale,
        canvas.height / scale,
      ),
      offscreenCtx = offscreen.getContext("2d")!;
    offscreenCtx.drawImage(image, 0, 0, offscreen.width, offscreen.height);
    const buffer = offscreenCtx.getImageData(
      0,
      0,
      offscreen.width,
      offscreen.height,
      { colorSpace: "srgb" },
    );
    const samples = new Array(buffer.width * buffer.height)
      .fill(0)
      .map((_, i) => {
        return srgb2xyz([
          buffer.data[i * 4 + 0] / 255,
          buffer.data[i * 4 + 1] / 255,
          buffer.data[i * 4 + 2] / 255,
        ]);
      });
    const copy = (v: XYZColor) => [...v] as XYZColor,
      dist = (a: XYZColor, b: XYZColor) => {
        return vector_dist(a as TVector3, b as TVector3);
      },
      average = (a: XYZColor[], w: number[] | null = null) => {
        const v = [0, 0, 0, 0];
        a.forEach((_, i) => {
          const w_ = w ? w[i] : 1;
          v[0] += a[i][0] * w_;
          v[1] += a[i][1] * w_;
          v[2] += a[i][2] * w_;
          v[3] += w_;
        });
        return [v[0] / v[3], v[1] / v[3], v[2] / v[3]] as XYZColor;
      };
    return { offscreen, samples, copy, dist, average };
  }
  function cluster() {
    if (!isActive || !image) return;
    const n_colors = palette.value.length;
    if (n_colors <= 0) {
      setPalette([]);
      return;
    }
    const { samples, copy, dist, average } = getSamples();
    const N_SAMPLE = samples.length;
    const max_iter = 1000;
    const closestKey = Object.keys(cache)
      .map((n) => Number.parseInt(n.toString()))
      .reduce((a, b) => {
        const dA = Math.abs(a - n_colors);
        const dB = Math.abs(b - n_colors);
        return dA === dB ? Math.min(a, b) : dA < dB ? a : b;
      }, 0);
    const seed = cache[closestKey] ?? [];
    setPalette(
      kMeans(samples, N_SAMPLE, n_colors, max_iter, seed, copy, dist, average),
    );
  }
  function snap() {
    if (!isActive || !image) return;
    const { samples, dist } = getSamples(),
      palette = getPalette().map((c) =>
        sample(
          samples,
          softargmax(
            samples.map((sample) => -dist(c, sample)),
            1 / 100000,
          ),
        ),
      );
    setPalette(palette);
  }
  function updateScore() {
    if (!isActive || !image) return;
    const { samples, dist } = getSamples(),
      palette = getPalette();
    if (palette.length === 0) return;
    const score = getSilhouetteScore(samples, palette, dist);
    form.querySelector<HTMLInputElement>("#palette-score")!.valueAsNumber =
      score;
  }

  function redraw(raw = false) {
    if (!isActive || !image) return;
    if (raw || palette.value.length === 0) {
      requestAnimationFrame(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        getSamples();
      });
      return;
    }
    requestAnimationFrame(() => {
      const imageData = getImageData(image, ctx.canvas);
      const palette = getPalette();
      applyColorMapping(imageData, _applyClosest, {
        color_palette: palette.map(xyz2srgb),
        embed_palette: palette,
      });
      ctx.putImageData(imageData, 0, 0);
    });
  }
  function extendPalette(n_colors: number) {
    if (!image) return;
    const { samples, copy, dist } = getSamples();
    palette.value = extendCentroids(
      samples,
      n_colors,
      palette.value.map(str2xyz),
      dist,
      copy,
    ).map(xyz2hex);
  }

  function lock() {
    form.querySelector<HTMLInputElement>("#palette-text")!.disabled = true;
    form.querySelector<HTMLInputElement>("#palette-count")!.disabled = true;
  }

  function unlock() {
    form.querySelector<HTMLInputElement>("#palette-text")!.disabled = false;
    form.querySelector<HTMLInputElement>("#palette-count")!.disabled = false;
  }

  function withLock(f: () => void) {
    lock();
    try {
      f();
    } finally {
      unlock();
    }
  }

  async function runAuto() {
    isAuto = true;
    clear(image);
    lock();
    try {
      for (let n_colors = 0; isAuto; n_colors++) {
        extendPalette(n_colors);
        cluster();
        updateScore();
        console.log(
          n_colors,
          palette.value,
          form.querySelector<HTMLInputElement>("#palette-score")!.value,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    } finally {
      unlock();
      isAuto = false;
    }
  }

  function toggleAuto() {
    if (isAuto) {
      isAuto = false;
      return;
    }
    runAuto();
  }

  return {
    start: (sketch: HTMLCanvasElement, config: HTMLFormElement) => {
      canvas = sketch;
      form = config;
      palette = new PaletteInput(
        form.querySelector<HTMLDivElement>("#palette")!,
        form.querySelector<HTMLTextAreaElement>("#palette-text")!,
      );
      ctx = canvas.getContext("2d", {
        willReadFrequently: true,
      })!;
      setup();
      onImageChange(form.querySelector<HTMLInputElement>("#image")!, clear);
      form
        .querySelector<HTMLButtonElement>("#calc")!
        .addEventListener("click", () => withLock(cluster));
      form
        .querySelector<HTMLButtonElement>("#snap")!
        .addEventListener("click", () => withLock(snap));
      form
        .querySelector<HTMLButtonElement>("#eval")!
        .addEventListener("click", () => withLock(updateScore));
      form
        .querySelector<HTMLButtonElement>("#draw-raw")!
        .addEventListener("click", () => redraw(true));
      form
        .querySelector<HTMLButtonElement>("#draw-quant")!
        .addEventListener("click", () => redraw(false));
      form
        .querySelector<HTMLInputElement>("#palette-count")!
        .addEventListener("change", function () {
          extendPalette(this.valueAsNumber);
        });
      palette.addChangeHandler((palette) => {
        form.querySelector<HTMLInputElement>("#palette-score")!.value = "";
        form.querySelector<HTMLInputElement>("#palette-count")!.value =
          palette.length.toString();
        cache[palette.length] = palette.map((c) => str2xyz(c));
      });
      form
        .querySelector<HTMLButtonElement>("#autorun")!
        .addEventListener("click", toggleAuto);
      isActive = true;
    },
    stop: () => {
      isActive = false;
    },
  };
}
