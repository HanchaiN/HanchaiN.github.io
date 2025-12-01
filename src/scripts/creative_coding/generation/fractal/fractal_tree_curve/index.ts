import {
  getPaletteAccentColor,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";
import { PHI } from "@/scripts/utils/math/constants.js";

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let isActive: boolean = false;
  let isBox: boolean = false;
  let depth: number = 0;
  const getBackground = () => getPaletteBaseColor(0);
  const getSecondary = () => getPaletteAccentColor(2);
  const getPrimary = () => getPaletteAccentColor(3);

  function draw(
    depth: number = 1,
    s: number = 1,
    w: number = 1,
    box: boolean = false,
  ) {
    let w_ = w;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < depth; i++) {
      ctx.lineWidth = w_;
      ctx.arc(s, 0, s, Math.PI, Math.PI / 2, true);
      if (box) {
        ctx.save();
        ctx.lineWidth = w_;
        ctx.strokeRect(0, 0, s, s);
        ctx.restore();
      }
      ctx.translate(s, s);
      ctx.rotate(-Math.PI / 2);
      s /= PHI;
      if (i == 0) {
        ctx.stroke();
        ctx.save();
        ctx.strokeStyle = getSecondary();
        ctx.scale(-1, 1);
        draw(depth - i - 1, s, w_ / (PHI + 1));
        ctx.restore();
        ctx.beginPath();
      } else {
        ctx.stroke();
        ctx.save();
        ctx.scale(-1, 1);
        draw(depth - i - 1, s, w_ / (PHI + 1));
        ctx.restore();
        w_ /= PHI;
        ctx.beginPath();
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function redraw(depth_: number = 1) {
    if (!isActive || !canvas || !Number.isInteger(depth_)) return;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (depth_ < 0) {
      depth = 0;
    } else {
      depth += depth_;
    }
    ctx.strokeStyle = getPrimary();
    ctx.lineWidth = 2;
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.translate(-canvas.height, 0);
    const s = canvas.height / PHI;
    const s0 = s / 2;
    const y0 = canvas.height * 0.5 - s0;
    ctx.translate(0, y0);
    ctx.moveTo(0, 0);
    draw(depth, s0, 5, isBox);
    ctx.restore();
  }

  return {
    start: (sketch: HTMLCanvasElement, config: HTMLFormElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      config.querySelector("#set")?.addEventListener("click", () => {
        redraw(1);
      });
      config.querySelector("#box")?.addEventListener("click", () => {
        isBox = !isBox;
        redraw(0);
      });
      config.querySelector("#reset")?.addEventListener("click", () => {
        redraw(-1);
      });
      isActive = true;
      redraw(-1);
    },
    stop: () => {
      isActive = false;
    },
  };
}
