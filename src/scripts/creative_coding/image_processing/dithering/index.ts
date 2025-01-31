import { onImageChange } from "@/scripts/utils/dom.js";
import {
  getPaletteBaseColors,
  getPaletteAccentColors,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";
import convert_color from "@/scripts/utils/color/conversion.js";
import { applyDithering } from "./pipeline.js";

const str2xyz = convert_color("str", "xyz")!;

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  const getBackground = () => getPaletteBaseColor(0);
  let isActive = false;
  const getPalette = () =>
    [...getPaletteAccentColors(), ...getPaletteBaseColors()].map((v) => {
      return str2xyz(v);
    });

  function setup() {
    if (!canvas) return;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function redraw(img: HTMLImageElement) {
    if (!isActive) return;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyDithering(imageData, getPalette());
    ctx.putImageData(imageData, 0, 0);
  }

  return {
    start: (sketch: HTMLCanvasElement, config: HTMLFormElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      onImageChange(config.querySelector<HTMLInputElement>("#image")!, redraw);
      setup();
      isActive = true;
    },
    stop: () => {
      isActive = false;
    },
  };
}
