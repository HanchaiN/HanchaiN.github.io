import convert_color from "@/scripts/utils/color/conversion.js";
import { generateGradient } from "@/scripts/utils/color/interpl.js";
import {
  getPaletteAccentColor,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";
import {
  constrainMap,
  gamma,
  symlog,
  symlog_inv,
} from "@/scripts/utils/math/utils.js";

import { ParticleSystem, SETTING } from "./particles.js";

const str2oklab = convert_color("str", "oklab")!,
  oklab2hex = convert_color("oklab", "hex")!;

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let volume_slider: HTMLInputElement;
  let volume_value: HTMLSlotElement;
  let temperature_slider: HTMLInputElement;
  let temperature_value: HTMLSlotElement;
  let pressure_slider: HTMLInputElement;
  let pressure_value: HTMLSlotElement;
  let entropy_slider: HTMLInputElement;
  let entropy_value: HTMLSlotElement;
  let system: ParticleSystem;
  const getBackground = () => getPaletteBaseColor(0);
  const getForeground = () => getPaletteBaseColor(1);
  const gradient = generateGradient(100, [
    [0 / 3, str2oklab(getPaletteAccentColor(5))],
    [1 / 3, str2oklab(getPaletteAccentColor(6))],
    [2 / 3, str2oklab(getPaletteAccentColor(7))],
    [3 / 3, str2oklab(getPaletteAccentColor(8))],
  ]).map((c) => oklab2hex(c));
  const n = 2048;
  const time_scale = 1;
  const max_dt = (1 / 8) * time_scale;
  let isActive = false;
  let pretime = 0;
  const scale = 1e-2;

  function setup() {
    if (!canvas) return;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    system.wall.right = canvas.width / scale;
    {
      const volumePerParticle =
        (Math.pow(Math.PI, SETTING.DOF_TRANS / 2) /
          gamma(SETTING.DOF_TRANS / 2 + 1)) *
        Math.pow(SETTING.DIAMETER / 2, 2);
      // lower bound on densest pack: volumePerParticle * Math.pow((SETTING.DOF_TRANS / (2 * Math.PI * Math.E)) / 4, SETTING.DOF_TRANS / 2);
      const maxPackingDensity = 0.886441; // Random pack in 2D
      volume_slider.min = (
        (n * volumePerParticle) /
        maxPackingDensity
      ).toString();
      volume_slider.max = ((canvas.height / scale) * system.w).toString();
      volume_slider.value = system.Volume.toString();
    }
    temperature_slider.min = symlog(SETTING.TempMin).toString();
    temperature_slider.max = symlog(SETTING.TempMax).toString();
    temperature_slider.value = symlog(system.Temperature).toString();
    pressure_slider.min = symlog(
      system.getPressure(Number.parseFloat(volume_slider.max), SETTING.TempMin),
    ).toString();
    pressure_slider.max = symlog(
      system.getPressure(Number.parseFloat(volume_slider.min), SETTING.TempMax),
    ).toString();
    entropy_slider.min = system
      .getEntropy(Number.parseFloat(volume_slider.min), SETTING.TempMin)
      .toString();
    entropy_slider.max = system
      .getEntropy(Number.parseFloat(volume_slider.max), SETTING.TempMax)
      .toString();
    entropy_slider.value = system.Entropy.toString();
  }

  function draw(time: number) {
    if (!isActive) return;
    if (pretime) {
      const deltaTime = ((time - pretime) * time_scale) / 1000;
      system.update(Math.min(deltaTime, max_dt), 4);
    }
    pretime = time;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    system.particles.forEach((particle) => {
      ctx.fillStyle =
        gradient[
          Math.round(
            constrainMap(
              symlog(particle.Temperature),
              symlog(SETTING.TempMin),
              symlog(SETTING.TempMax),
              0,
              gradient.length - 1,
            ),
          )
        ];
      ctx.beginPath();
      ctx.arc(
        particle.pos.x * scale,
        particle.pos.y * scale,
        (SETTING.DIAMETER / 2) * scale,
        0,
        2 * Math.PI,
      );
      ctx.fill();
    });
    ctx.lineWidth = 1;
    ctx.strokeStyle = getForeground();
    ctx.beginPath();
    ctx.moveTo(0, system.h * scale);
    ctx.lineTo(canvas.width, system.h * scale);
    ctx.stroke();
    temperature_value.innerText = system.Temperature.toExponential(2);
    pressure_slider.value = symlog(system.Pressure).toString();
    pressure_value.innerText = system.Pressure.toExponential(2);
    entropy_slider.value = system.Entropy.toString();
    entropy_value.innerText = system.Entropy.toExponential(2);
    requestAnimationFrame(draw);
  }

  function volume_handler() {
    const value = volume_slider.valueAsNumber / system.w;
    system.wall.bottom = value;
    volume_value.innerText = system.Volume.toExponential(2);
  }
  function temperature_handler() {
    const value = symlog_inv(temperature_slider.valueAsNumber);
    system.wall_temp.bottom = value;
  }
  return {
    start: (sketch: HTMLCanvasElement, config: HTMLFormElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      {
        const velMax = (10 * SETTING.DIAMETER) / max_dt;
        const velMin = 0.1 / scale / max_dt;
        SETTING.TempMax =
          (Math.pow(velMax, 2) * SETTING.MASS) /
          (SETTING.BOLTZMANN * (SETTING.DOF_TRANS - 1));
        SETTING.TempMin =
          (Math.pow(velMin, 2) * SETTING.MASS) /
          (SETTING.BOLTZMANN * (SETTING.DOF_TRANS - 1));
      }
      system = new ParticleSystem(
        canvas.width / scale,
        canvas.height / scale,
        n,
        SETTING.TempMax,
      );
      volume_slider = config.querySelector("#volume")!;
      volume_value = config.querySelector("#volume-value")!;
      temperature_slider = config.querySelector("#temperature")!;
      temperature_value = config.querySelector("#temperature-value")!;
      pressure_slider = config.querySelector("#pressure")!;
      pressure_value = config.querySelector("#pressure-value")!;
      entropy_slider = config.querySelector("#entropy")!;
      entropy_value = config.querySelector("#entropy-value")!;
      volume_slider.addEventListener("input", volume_handler);
      temperature_slider.addEventListener("input", temperature_handler);
      volume_slider.addEventListener("change", () => system.resetStat(0));
      temperature_slider.addEventListener("change", () => system.resetStat(0));
      setup();
      volume_handler();
      temperature_handler();
      isActive = true;
      requestAnimationFrame(draw);
    },
    stop: () => {
      isActive = false;
    },
  };
}
