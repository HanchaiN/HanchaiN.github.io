import { generate } from "./pipeline.js";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";

export default function execute() {
  let isActive = false;
  const scale = 1;

  function redraw(ctx: CanvasRenderingContext2D) {
    if (!isActive) return;

    ctx.fillStyle = getPaletteBaseColor(0.5);
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const buffer = ctx.createImageData(
      ctx.canvas.width / scale,
      ctx.canvas.height / scale,
    );
    generate(buffer);
    ctx.putImageData(buffer, 0, 0);
  }

  return {
    start: (canvas: HTMLCanvasElement) => {
      isActive = true;
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      })!;
      canvas.addEventListener("click", function () {
        requestAnimationFrame(() => redraw(ctx));
      });
      redraw(ctx);
    },
    stop: () => {
      isActive = false;
    },
  };
}
