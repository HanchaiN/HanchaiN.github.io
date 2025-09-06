import convert_color from "@/scripts/utils/color/conversion.js";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { PaletteInput } from "@/scripts/utils/dom/element/PaletteInput.js";
import { SelectDisplay } from "@/scripts/utils/dom/element/SelectDisplay.js";
import {
  getImageData,
  getImageFromInput,
  onImageChange,
} from "@/scripts/utils/dom/image.js";

import {
  applyDithering_ErrorDiffusion,
  applyDithering_Ordered,
} from "./pipeline.js";

const str2srgb = convert_color("str", "srgb")!;

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let conf: HTMLFormElement;
  let palette: PaletteInput;
  const getBackground = () => getPaletteBaseColor(0);
  let isActive = false;
  const getPalette = () => palette.value.map((c) => str2srgb(c));

  function clear() {
    if (!canvas) return;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  async function redraw() {
    if (!isActive) return;
    clear();
    const imageData = getImageData(
      await getImageFromInput(conf.querySelector<HTMLInputElement>("#image")!),
      canvas,
    );
    const temperature =
      conf.querySelector<HTMLInputElement>("#temperature")!.valueAsNumber;
    const err_decay =
      conf.querySelector<HTMLInputElement>("#err_decay")!.valueAsNumber;
    const mask_order =
      conf.querySelector<HTMLInputElement>("#mask_order")!.valueAsNumber;
    const param = {
      temperature,
      err_decay,
      mask_size: Math.pow(2, mask_order),
    };
    const algo = conf.querySelector<HTMLSelectElement>("#algorithm")!.value;
    switch (algo) {
      case "order":
        applyDithering_Ordered(imageData, getPalette(), param);
        break;
      case "error":
        applyDithering_ErrorDiffusion(imageData, getPalette(), param);
        break;
      default:
        alert("Invalid algorithm");
        break;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return {
    start: (sketch: HTMLCanvasElement, config: HTMLFormElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      conf = config;
      onImageChange(
        config.querySelector<HTMLInputElement>("#image")!,
        (img) => {
          clear();
          getImageData(img, canvas);
        },
      );
      const algo = new SelectDisplay(
        config.querySelector<HTMLSelectElement>("#algorithm")!,
        config.querySelector("#advanced")!,
      );
      palette = new PaletteInput(
        config.querySelector("#palette")!,
        config.querySelector("#palette-text")!,
      );
      palette.addChangeHandler((p) => {
        let t = 1;
        if (p.length === 0) t = 1;
        else if (algo.value === "order")
          t = 1 / ((p.length * (p.length - 1)) / 2 - 1);
        else if (algo.value === "error") t = 1 / (p.length - 1);
        config.querySelector<HTMLInputElement>("#temperature")!.valueAsNumber =
          t;
      });
      config
        .querySelector<HTMLButtonElement>("#apply")!
        .addEventListener("click", () => {
          redraw();
        });
      clear();
      isActive = true;
    },
    stop: () => {
      isActive = false;
    },
  };
}
