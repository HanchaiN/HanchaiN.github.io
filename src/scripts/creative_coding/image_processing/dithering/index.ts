import {
  getImageFromInput,
  getImageData,
  onImageChange,
} from "@/scripts/utils/dom/image.js";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import convert_color from "@/scripts/utils/color/conversion.js";
import {
  applyDithering_ErrorDiffusion,
  applyDithering_Ordered,
} from "./pipeline.js";
import { PaletteInput } from "@/scripts/utils/dom/element/PaletteInput.js";

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
    const temp =
      conf.querySelector<HTMLInputElement>("#temperature")!.valueAsNumber;
    const algo = conf.querySelector<HTMLSelectElement>("#algorithm")!.value;
    switch (algo) {
      case "order":
        applyDithering_Ordered(imageData, getPalette(), temp);
        break;
      case "error":
        applyDithering_ErrorDiffusion(imageData, getPalette(), temp);
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
      palette = new PaletteInput(
        config.querySelector("#palette")!,
        config.querySelector("#palette-text")!,
      );
      palette.addChangeHandler((p) => {
        config.querySelector<HTMLInputElement>("#temperature")!.value = (
          p.length > 0 ? 1 / (p.length - 1) : 1
        ).toString();
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
