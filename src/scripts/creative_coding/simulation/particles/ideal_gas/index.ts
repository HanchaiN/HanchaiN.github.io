import convert_color from "@/scripts/utils/color/conversion.js";
import { generateGradient } from "@/scripts/utils/color/interpl.js";
import {
  getPaletteAccentColor,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";
import { startAnimationLoop, startLoop } from "@/scripts/utils/dom/utils.js";
import {
  constrainMap,
  gamma,
  symlog,
  symlog_inv,
} from "@/scripts/utils/math/utils.js";

import { ParticleSystem, SETTING } from "./particles.js";

const str2lab = convert_color("str", "lab")!,
  lab2hex = convert_color("lab", "hex")!;

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let volume_slider: HTMLInputElement;
  let volume_value: HTMLOutputElement;
  let wall_temperature_slider: HTMLInputElement;
  let wall_temperature_value: HTMLOutputElement;
  let gas_temperature_slider: HTMLInputElement;
  let gas_temperature_value: HTMLOutputElement;
  let wall_pressure_slider: HTMLInputElement;
  let wall_pressure_value: HTMLOutputElement;
  let calc_pressure_slider: HTMLInputElement;
  let calc_pressure_value: HTMLOutputElement;
  let entropy_slider: HTMLInputElement;
  let entropy_value: HTMLOutputElement;
  let system: ParticleSystem;
  const getBackground = () => getPaletteBaseColor(0);
  const getForeground = () => getPaletteBaseColor(1);
  const gradient = generateGradient(100, [
    [0 / 3, str2lab(getPaletteAccentColor(5))],
    [1 / 3, str2lab(getPaletteAccentColor(6))],
    [2 / 3, str2lab(getPaletteAccentColor(7))],
    [3 / 3, str2lab(getPaletteAccentColor(8))],
  ]).map((c) => lab2hex(c));
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
    wall_temperature_slider.min = gas_temperature_slider.min = symlog(
      SETTING.TempMin,
    ).toString();
    wall_temperature_slider.max = gas_temperature_slider.max = symlog(
      SETTING.TempMax,
    ).toString();
    wall_temperature_slider.value = symlog(system.Temperature).toString();
    wall_pressure_slider.min = calc_pressure_slider.min = symlog(
      system.getPressure(Number.parseFloat(volume_slider.max), SETTING.TempMin),
    ).toString();
    wall_pressure_slider.max = calc_pressure_slider.max = symlog(
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

  function update(time: number) {
    if (!isActive) return false;
    if (pretime) {
      const deltaTime = ((time - pretime) * time_scale) / 1000;
      system.update(Math.min(deltaTime, max_dt), 4);
    }
    pretime = time;
    return true;
  }
  function draw() {
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
    gas_temperature_slider.value = symlog(system.Temperature).toString();
    gas_temperature_value.value = system.Temperature.toExponential(2);
    wall_pressure_slider.value = symlog(system.WallPressure).toString();
    wall_pressure_value.value = system.WallPressure.toExponential(2);
    calc_pressure_slider.value = symlog(system.CalcPressure).toString();
    calc_pressure_value.value = system.CalcPressure.toExponential(2);
    entropy_slider.value = system.Entropy.toString();
    entropy_value.value = system.Entropy.toExponential(2);
    return true;
  }

  function volume_handler() {
    const value = volume_slider.valueAsNumber / system.w;
    system.wall.bottom = value;
    volume_value.value = system.Volume.toExponential(2);
  }
  function temperature_handler() {
    const value = symlog_inv(wall_temperature_slider.valueAsNumber);
    system.wall_temp.bottom = value;
    wall_temperature_value.value = value.toExponential(2);
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
      wall_temperature_slider = config.querySelector("#wall-temperature")!;
      wall_temperature_value = config.querySelector("#wall-temperature-value")!;
      gas_temperature_slider = config.querySelector("#gas-temperature")!;
      gas_temperature_value = config.querySelector("#gas-temperature-value")!;
      wall_pressure_slider = config.querySelector("#wall-pressure")!;
      wall_pressure_value = config.querySelector("#wall-pressure-value")!;
      calc_pressure_slider = config.querySelector("#calc-pressure")!;
      calc_pressure_value = config.querySelector("#calc-pressure-value")!;
      entropy_slider = config.querySelector("#entropy")!;
      entropy_value = config.querySelector("#entropy-value")!;
      volume_slider.addEventListener("input", volume_handler);
      wall_temperature_slider.addEventListener("input", temperature_handler);
      volume_slider.addEventListener("change", () => system.resetStat(0));
      wall_temperature_slider.addEventListener("change", () =>
        system.resetStat(0),
      );
      setup();
      volume_handler();
      temperature_handler();
      isActive = true;
      startAnimationLoop(draw);
      startLoop(update);
    },
    stop: () => {
      isActive = false;
    },
  };
}
