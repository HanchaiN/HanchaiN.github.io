import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import convert_color from "@/scripts/utils/color/conversion.js";
import { getBaseLUT, applyClosest, applyGaussianRBF } from "./pipeline.js";
import { PaletteInput } from "@/scripts/utils/dom/element/PaletteInput.js";

const str2srgb = convert_color("str", "srgb")!;

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let palette: PaletteInput;
  let algo_conf: HTMLElement;
  const getBackground = () => getPaletteBaseColor(0);
  let isActive = false;

  enum Algorithm {
    NONE = "",
    NEAREST = "nearest",
    GAUSSIAN = "gaussian",
  }

  function clear() {
    if (!canvas) return;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function generate(level: number, algo: Algorithm) {
    if (!isActive) return;
    canvas.width = canvas.height = level * level * level;
    clear();
    const buffer = ctx.getImageData(0, 0, canvas.width, canvas.height, {
      colorSpace: "srgb",
    });
    getBaseLUT(buffer);
    const palette_ = palette.value.map(str2srgb);
    switch (algo) {
      case Algorithm.NEAREST:
        applyClosest(buffer, palette_);
        break;

      case Algorithm.GAUSSIAN:
        applyGaussianRBF(
          buffer,
          palette_,
          algo_conf.querySelector<HTMLInputElement>("#temperature")!
            .valueAsNumber,
          algo_conf.querySelector<HTMLInputElement>("#count")!.valueAsNumber,
        );
        break;

      default:
        break;
    }
    ctx.putImageData(buffer, 0, 0);
  }

  function updateAlgoConfig(algo: Algorithm) {
    switch (algo) {
      case Algorithm.GAUSSIAN: {
        algo_conf.innerHTML = "";
        const tempLabel = document.createElement("label");
        tempLabel.htmlFor = "temperature";
        tempLabel.textContent = "Temperature";
        algo_conf.appendChild(tempLabel);
        const temp = document.createElement("input");
        temp.type = "number";
        temp.id = "temperature";
        temp.min = "0";
        temp.step = "1e-5";
        temp.value = "0.05";
        algo_conf.appendChild(temp);
        const countLabel = document.createElement("label");
        countLabel.htmlFor = "count";
        countLabel.textContent = "Color Count";
        algo_conf.appendChild(countLabel);
        const count = document.createElement("input");
        count.type = "number";
        count.id = "count";
        count.min = "0";
        count.step = "1";
        count.value = "3";
        algo_conf.appendChild(count);
        break;
      }

      default:
        algo_conf.innerHTML = "";
        break;
    }
  }

  return {
    start: (sketch: HTMLCanvasElement, config: HTMLFormElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      palette = new PaletteInput(
        config.querySelector<HTMLDivElement>("#palette")!,
        config.querySelector<HTMLTextAreaElement>("#palette-text")!,
      );
      algo_conf = config.querySelector<HTMLDivElement>("#algorithm-options")!;
      const algo = config.querySelector<HTMLSelectElement>("#algorithm")!;
      const level = config.querySelector<HTMLInputElement>("#level")!;
      algo.addEventListener("change", function () {
        updateAlgoConfig(this.value as Algorithm);
      });
      updateAlgoConfig(algo.value as Algorithm);
      config
        .querySelector<HTMLButtonElement>("#apply")!
        .addEventListener("click", () => {
          generate(level.valueAsNumber, algo.value as Algorithm);
        });
      clear();
      isActive = true;
    },
    stop: () => {
      isActive = false;
    },
  };
}
