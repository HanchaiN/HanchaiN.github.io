import { onImageChange } from "@/scripts/utils/dom/image.js";
import { map } from "@/scripts/utils/math/utils.js";
import convert_color from "@/scripts/utils/color/conversion.js";
import { getEdgeMask } from "./pipeline.js";
import {
  getChroma,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";

const okhcl2srgb = convert_color("okhcl", "srgb")!,
  str2srgb = convert_color("str", "srgb")!,
  srgb2okhcl = convert_color("srgb", "okhcl")!;

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  const getBackground = () => getPaletteBaseColor(0);
  const getForeground = () => getPaletteBaseColor(1);
  let isActive = false;

  function setup() {
    if (!canvas) return;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawEdge(
    imageData: ImageData,
    dxIndex: number = 0,
    dyIndex: number = 1,
    magIndex: number = 2,
    maskIndex: number = 3,
  ) {
    const foreground = str2srgb(getForeground()),
      saturation = getChroma(),
      lightness = srgb2okhcl(foreground)[2];
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const index = (y * imageData.width + x) * 4;
        const dx = 2 * (imageData.data[index + dxIndex] - 128);
        const dy = 2 * (imageData.data[index + dyIndex] - 128);
        const mag = imageData.data[index + magIndex];
        const mask = imageData.data[index + maskIndex];
        const dir = map(Math.atan2(dy, dx), -Math.PI, +Math.PI, 0, 1);
        if (mask === 255) {
          imageData.data[index] = foreground[0] * 255;
          imageData.data[index + 1] = foreground[1] * 255;
          imageData.data[index + 2] = foreground[2] * 255;
        } else {
          const [r, g, b] = okhcl2srgb([
            dir,
            saturation,
            lightness * Math.pow(mag / 255, 1 / 3),
          ]);
          imageData.data[index] = 255 * r;
          imageData.data[index + 1] = 255 * g;
          imageData.data[index + 2] = 255 * b;
        }
        imageData.data[index + 3] = 255;
      }
    }
  }

  function redraw(img: HTMLImageElement) {
    if (!isActive) return;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height, {
      colorSpace: "srgb",
    });
    getEdgeMask(imageData);
    drawEdge(imageData);
    ctx.putImageData(imageData, 0, 0);
  }

  return {
    start: (sketch: HTMLCanvasElement, config: HTMLFormElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: true,
      })!;
      onImageChange(config.querySelector<HTMLInputElement>("#image")!, redraw);
      setup();
      isActive = true;
    },
    stop: () => {
      isActive = false;
    },
  };
}
