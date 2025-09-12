import convert_color, { srgba2css } from "@/scripts/utils/color/conversion.js";
import {
  getChroma,
  getLightness,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";
import { startAnimationLoop, startLoop } from "@/scripts/utils/dom/utils.js";

import { BoidSystem, SETTING } from "./boid.js";

const str2srgb = convert_color("str", "srgb")!,
  hcl2hex = convert_color("hcl", "hex")!;

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let system: BoidSystem;
  const getBackground = () => getPaletteBaseColor(0);
  const getForeground = () => {
    const c = str2srgb(getPaletteBaseColor(1));
    const alpha =
      Number.parseInt(
        getComputedStyle(document.body).getPropertyValue(
          "--state-opacity-hover",
        ),
      ) / 100;
    return srgba2css(c, alpha);
  };
  const time_scale = 1;
  let isActive = false;
  let pretime = 0;
  const scale = 0.5;

  function setup() {
    if (!canvas) return;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    system.wall.right = canvas.width / scale;
    system.wall.bottom = canvas.height / scale;
  }

  function update(time: number) {
    if (!isActive) return false;
    if (pretime) {
      const deltaTime = (time - pretime) * time_scale;
      system.update(Math.min(deltaTime, 500), 1);
      // const subdivide = Math.ceil(deltaTime / 500);
      // system.update(deltaTime, subdivide);
    }
    pretime = time;
    return true;
  }
  function draw() {
    const background = getBackground(),
      foreground = getForeground(),
      lightness = getLightness(),
      saturation = getChroma();
    ctx.lineWidth = 0;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    system.data().forEach(({ p, d }) => {
      ctx.fillStyle = foreground;
      ctx.beginPath();
      ctx.arc(
        p.x * scale,
        p.y * scale,
        (SETTING.separationRange * scale) / 2,
        0,
        2 * Math.PI,
      );
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x * scale, p.y * scale);
      ctx.arc(
        p.x * scale,
        p.y * scale,
        (SETTING.visualRange * scale) / 2,
        Math.atan2(d.y, d.x) - SETTING.visualAngle / 2,
        Math.atan2(d.y, d.x) + SETTING.visualAngle / 2,
      );
      ctx.lineTo(p.x * scale, p.y * scale);
      ctx.fill();
    });
    system.data().forEach(({ c, p }) => {
      ctx.fillStyle = hcl2hex([c / 360, saturation, lightness]);
      ctx.beginPath();
      ctx.arc(p.x * scale, p.y * scale, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
    return true;
  }

  return {
    start: (sketch: HTMLCanvasElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      system = new BoidSystem(canvas.width / scale, canvas.height / scale, 256);
      setup();
      isActive = true;
      startLoop(update);
      startAnimationLoop(draw);
    },
    stop: () => {
      isActive = false;
      // system = ctx = canvas = null;
    },
  };
}
