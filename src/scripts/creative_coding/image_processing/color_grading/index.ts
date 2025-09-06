import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { getImageData, getImageFromInput } from "@/scripts/utils/dom/image.js";

import { detectLevel } from "../clut_generation/pipeline.js";
import { applyGrading } from "./pipeline.js";

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let imgInp: HTMLInputElement;
  let lutInp: HTMLInputElement;
  const getBackground = () => getPaletteBaseColor(0);
  let isActive = false;

  function clear() {
    if (!canvas) return;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  async function redraw() {
    if (!isActive) return;
    clear();
    let img: HTMLImageElement | null = null;
    try {
      img = await getImageFromInput(imgInp);
    } catch (error) {
      if (error === "No file selected") return;
      throw error;
    }
    if (!img) {
      return;
    }
    const imgData = getImageData(img, canvas);

    let lut: HTMLImageElement | null = null;
    try {
      lut = await getImageFromInput(lutInp);
    } catch (error) {
      if (error === "No file selected") return;
      throw error;
    }
    if (!lut) {
      return;
    }
    try {
      detectLevel(lut.naturalWidth, lut.naturalHeight);
    } catch (error) {
      lutInp.value = "";
      alert(error);
      return;
    }
    const lutData = getImageData(lut);
    applyGrading(imgData, lutData);
    ctx.putImageData(imgData, 0, 0);
  }

  return {
    start: (sketch: HTMLCanvasElement, config: HTMLFormElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      imgInp = config.querySelector<HTMLInputElement>("#image")!;
      lutInp = config.querySelector<HTMLInputElement>("#clut")!;
      imgInp.addEventListener("change", redraw);
      lutInp.addEventListener("change", redraw);
      clear();
      isActive = true;
    },
    stop: () => {
      isActive = false;
    },
  };
}
