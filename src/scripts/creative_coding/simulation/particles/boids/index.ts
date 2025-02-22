import convert_color, { srgba2css } from "@/scripts/utils/color/conversion.js";
import { BoidSystem, SETTING } from "./boid.js";
import {
  getChroma,
  getLightness,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";

const str2srgb = convert_color("str", "srgb")!,
  okhcl2hex = convert_color("okhcl", "hex")!;

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

  function draw(time: number) {
    if (!isActive) return;
    if (pretime) {
      const deltaTime = (time - pretime) * time_scale;
      system.update(Math.min(deltaTime, 500), 1);
      // const subdivide = Math.ceil(deltaTime / 500);
      // system.update(deltaTime, subdivide);
    }
    const background = getBackground(),
      foreground = getForeground(),
      lightness = getLightness(),
      saturation = getChroma();
    pretime = time;
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
      ctx.fillStyle = okhcl2hex([c / 360, saturation, lightness]);
      ctx.beginPath();
      ctx.arc(p.x * scale, p.y * scale, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  return {
    start: (sketch: HTMLCanvasElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      system = new BoidSystem(canvas.width / scale, canvas.height / scale, 256);
      setup();
      isActive = true;
      requestAnimationFrame(draw);
    },
    stop: () => {
      isActive = false;
      // system = ctx = canvas = null;
    },
  };
}
