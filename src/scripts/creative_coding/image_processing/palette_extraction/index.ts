import convert_color from "@/scripts/utils/color/conversion.js";
import type {
  ColorSpace,
  ColorSpaceMap,
  SRGBColor,
} from "@/scripts/utils/color/conversion.ts";
import { DistanceE94 } from "@/scripts/utils/color/distance.js";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { PaletteInput } from "@/scripts/utils/dom/element/PaletteInput.js";
import { getImageData, onImageChange } from "@/scripts/utils/dom/image.js";
import { argmax, average } from "@/scripts/utils/math/utils.js";

import { _applyClosest } from "../clut_generation/pipeline.js";
import { applyColorMapping } from "../color_grading/pipeline.js";
import { evaluatePalette, extendPalette, extractPalette } from "./pipeline.js";

const embed: ColorSpace = "lab";
type EmbedColor = ColorSpaceMap[typeof embed];
const srgb2embed = convert_color("srgb", embed)!,
  embed2srgb = convert_color(embed, "srgb")!,
  str2embed = convert_color("str", embed)!,
  embed2hex = convert_color(embed, "hex")!;
const color_distance: (c1: EmbedColor, c2: EmbedColor) => number = DistanceE94;

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let palette: PaletteInput;
  const getBackground = () => getPaletteBaseColor(0);
  let isActive = false;
  let isAuto = false;
  let image: HTMLImageElement;
  let form: HTMLFormElement;
  let cache: { [n: number]: EmbedColor[] } = {};
  const getPalette = () => palette.value.map((c) => str2embed(c));
  const setPalette = (cs: EmbedColor[]) => {
    palette.value = cs.map((c) => embed2hex(c));
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
  function getSample(sample_size: number = -1) {
    const offscreen = new OffscreenCanvas(image.width, image.height),
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
      .map((_, i) => i)
      .sort(() => Math.random() - 0.5)
      .slice(0, sample_size)
      .map<SRGBColor>((i) => {
        return [
          buffer.data[i * 4 + 0] / 255,
          buffer.data[i * 4 + 1] / 255,
          buffer.data[i * 4 + 2] / 255,
        ];
      });
    return samples;
  }
  function cluster() {
    if (!isActive || !image) return;
    const n_colors = palette.value.length;
    if (n_colors <= 0) {
      setPalette([]);
      return;
    }
    const closestKey = Object.keys(cache)
      .map((n) => Number.parseInt(n.toString()))
      .reduce((a, b) => {
        const dA = Math.abs(a - n_colors);
        const dB = Math.abs(b - n_colors);
        return dA === dB ? Math.min(a, b) : dA < dB ? a : b;
      }, 0);
    const seed = cache[closestKey] ?? [];
    setPalette(
      extractPalette(getSample(), n_colors, seed.map(embed2hex)).map(
        (c) => str2embed(c),
        {
          n_sample: form.querySelector<HTMLInputElement>(
            "#sample-size-cluster",
          )!.valueAsNumber,
        },
      ),
    );
  }
  function snap() {
    if (!isActive || !image) return;
    const samples = getSample().map(srgb2embed),
      palette = getPalette().map(
        (c) =>
          samples[argmax(samples.map((sample) => -color_distance(c, sample)))],
      );
    setPalette(palette);
  }
  function updateScore() {
    if (!isActive || !image) return;
    const palette = getPalette();
    if (palette.length === 0) return;
    const sample_size =
      form.querySelector<HTMLInputElement>("#sample-size-eval")!.valueAsNumber;
    const iter =
      form.querySelector<HTMLInputElement>("#eval-iter")!.valueAsNumber;
    const score =
      iter > 0
        ? average(
            new Array(iter).fill(0).map(() =>
              evaluatePalette(
                getSample(sample_size > 0 ? sample_size : -1),
                palette.map(embed2hex),
                {
                  simplify_a:
                    form.querySelector<HTMLInputElement>("#simplify-a")!
                      .checked,
                  simplify_b:
                    form.querySelector<HTMLInputElement>("#simplify-b")!
                      .checked,
                },
              ),
            ),
          )
        : 0;
    form.querySelector<HTMLInputElement>("#palette-score")!.valueAsNumber =
      score;
  }

  function redraw(raw = false) {
    if (!isActive || !image) return;
    if (raw || palette.value.length === 0) {
      requestAnimationFrame(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      });
      return;
    }
    requestAnimationFrame(() => {
      const imageData = getImageData(image, ctx.canvas);
      const palette = getPalette();
      applyColorMapping(imageData, _applyClosest, {
        color_palette: palette.map(embed2srgb),
        embed_palette: palette,
      });
      ctx.putImageData(imageData, 0, 0);
    });
  }
  function extend(n_colors: number) {
    if (!image) return;
    palette.value = extendPalette(getSample(), n_colors, palette.value);
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
    const target =
      form.querySelector<HTMLInputElement>("#auto-target")!.valueAsNumber;
    clear(image);
    lock();
    try {
      for (
        let n_colors = 0;
        isAuto && (target === 0 || n_colors < target);
        n_colors++
      ) {
        await new Promise((resolve) =>
          requestIdleCallback(
            () => {
              extend(n_colors);
              cluster();
              redraw();
              updateScore();
              console.info(
                n_colors,
                palette.value,
                form.querySelector<HTMLInputElement>("#palette-score")!.value,
              );
              resolve(true);
            },
            { timeout: 1000 },
          ),
        );
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
          extend(this.valueAsNumber);
        });
      palette.addChangeHandler((palette) => {
        form.querySelector<HTMLInputElement>("#palette-score")!.value = "";
        form.querySelector<HTMLInputElement>("#palette-count")!.value =
          palette.length.toString();
        cache[palette.length] = palette.map((c) => str2embed(c));
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
