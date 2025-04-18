import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import convert_color, { ColorSpace } from "@/scripts/utils/color/conversion.js";
import {
  getBaseLUT,
  applyClosest,
  applyGaussianRBF,
  applyInverseRBF,
  applyCustomMap,
  applyCustomRBF,
} from "./pipeline.js";
import { PaletteInput } from "@/scripts/utils/dom/element/PaletteInput.js";
import { SelectDisplay } from "@/scripts/utils/dom/element/SelectDisplay.js";
import { try_catch } from "@/scripts/utils/utils.js";

const str2srgb = convert_color("str", "srgb")!;

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let palette: PaletteInput;
  const getBackground = () => getPaletteBaseColor(0);
  let isActive = false;

  enum Algorithm {
    NONE = "",
    NEAREST = "nearest",
    GAUSSIAN = "gaussian",
    INVERSE = "inverse",
    RBF = "rbf",
    MAP = "map",
  }

  function clear() {
    if (!canvas) return;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function generate(level: number, algo_view: SelectDisplay<Algorithm>) {
    if (!isActive) return;
    canvas.width = canvas.height = level * level * level;
    clear();
    const buffer = ctx.getImageData(0, 0, canvas.width, canvas.height, {
      colorSpace: "srgb",
    });
    getBaseLUT(buffer);
    const palette_ = palette.value.map(str2srgb);
    switch (algo_view.value) {
      case Algorithm.NEAREST:
        applyClosest(buffer, palette_);
        break;

      case Algorithm.GAUSSIAN:
        applyGaussianRBF(
          buffer,
          palette_,
          algo_view.display.querySelector<HTMLInputElement>("#temperature")!
            .valueAsNumber,
          algo_view.display.querySelector<HTMLInputElement>("#count")!
            .valueAsNumber,
        );
        break;

      case Algorithm.INVERSE:
        applyInverseRBF(
          buffer,
          palette_,
          algo_view.display.querySelector<HTMLInputElement>("#count")!
            .valueAsNumber,
        );
        break;

      case Algorithm.RBF:
        applyCustomRBF(
          buffer,
          palette_,
          algo_view.display.querySelector<HTMLInputElement>("#count")!
            .valueAsNumber,
          try_catch<(d: number) => number>(
            () =>
              eval?.(
                `"use strict";(${algo_view.display.querySelector<HTMLInputElement>("#rbf")!.value})`,
              ),
            (d) => Math.exp(-Math.pow(d, 2) / 0.05),
            (e) => {
              console.error("Error in rbf function", e);
            },
          ),
        );
        break;

      case Algorithm.MAP:
        applyCustomMap(
          buffer,
          algo_view.display.querySelector<HTMLSelectElement>("#color-space")!
            .value as ColorSpace,
          try_catch<(c: [number, number, number]) => [number, number, number]>(
            () =>
              eval?.(
                `"use strict";(${algo_view.display.querySelector<HTMLInputElement>("#mapper")!.value})`,
              ),
            ([c1, c2, c3]) => [c1, c2, c3],
            (e) => {
              console.error("Error in mapper function", e);
            },
          ),
        );
        break;

      case Algorithm.NONE:
        break;

      default:
        throw new Error("Unknown algorithm", algo_view.value);
    }
    ctx.putImageData(buffer, 0, 0);
  }

  return {
    start: (sketch: HTMLCanvasElement, config: HTMLFormElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      palette = new PaletteInput(
        config.querySelector<HTMLDivElement>("#palette")!,
        config.querySelector<HTMLTextAreaElement>("#palette-text")!,
      );
      const algo_view = new SelectDisplay<Algorithm>(
        config.querySelector<HTMLSelectElement>("#algorithm")!,
        config.querySelector<HTMLDivElement>("#algorithm-options")!,
      );
      const level = config.querySelector<HTMLInputElement>("#level")!;
      config
        .querySelector<HTMLButtonElement>("#apply")!
        .addEventListener("click", () => {
          generate(level.valueAsNumber, algo_view);
        });
      clear();
      isActive = true;
    },
    stop: () => {
      isActive = false;
    },
  };
}
