import { getColor, kernelGenerator } from "@/script/utils/dom";
import { TComplex, TVector3, constrain, fpart, map } from "@/script/utils/math";
import type { IKernelFunctionThis } from "@/script/utils/types";
import * as color from "@thi.ng/color";
import { psi_orbital_superposition } from "./psi";

export default function execute() {
  const T = 20_000;
  const R = Math.pow(4 + 2, 2);
  const scale = 4;
  let isActive = false;
  const state: { c: TComplex; n: number; l: number; m: number }[] = [
    { c: [1, 0], n: 4, l: 2, m: -1 },
  ];

  interface IConstants {
    R: number;
  }

  function psi(this: IKernelFunctionThis<IConstants>, x: TVector3, t: number) {
    return psi_orbital_superposition(state, x, t);
  }
  function main(this: IKernelFunctionThis<IConstants>, z: number, t: number) {
    const x = map(
      (this.thread.x + 0.5) / this.output.x,
      0,
      1,
      -this.constants.R,
      +this.constants.R,
    );
    const y = map(
      (this.thread.y + 0.5) / this.output.y,
      0,
      1,
      -this.constants.R,
      +this.constants.R,
    );
    const vec: TVector3 = [x, y, z];
    const v = psi.bind(this)(vec, t);
    const prob = 5000 * (v[0] * v[0] + v[1] * v[1]);
    const phase = Math.atan2(v[1], v[0]);
    const brightness = Math.pow(prob / (prob + 1), 0.5);
    const c = color.srgb(
      color.oklch([
        constrain(brightness, 0, 1),
        0.05,
        (phase < 0.0 ? phase + 2 * Math.PI : phase) / (2.0 * Math.PI),
      ]),
    );
    this.color(c.r, c.g, c.b, 1);
  }

  return {
    start: (foreground: HTMLCanvasElement, canvas: HTMLCanvasElement) => {
      isActive = true;
      {
        const ctx = canvas.getContext("2d", {
          alpha: false,
          desynchronized: true,
        })!;
        const buffer = ctx.createImageData(
          canvas.width / scale,
          canvas.height / scale,
        );
        const renderer = kernelGenerator(main, { R }, buffer);
        requestAnimationFrame(function draw(t) {
          if (!isActive) return;
          const z = map(fpart(t / T), 0, 1, -R, +R);
          const step = renderer(z, 0.0);
          while (!step.next().done) {
            continue;
          }
          createImageBitmap(buffer).then((bmp) =>
            ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height),
          );
          requestAnimationFrame(draw);
        });
      }
      {
        const ctx = foreground.getContext("2d", {
          alpha: true,
          desynchronized: true,
        })!;
        requestAnimationFrame(function draw(t) {
          if (!isActive) return;
          const z = map(fpart(t / T), 0, 1, -R, +R);
          ctx.clearRect(0, 0, foreground.width, foreground.height);
          for (let i = 0; i <= R; i++) {
            if (Number.isInteger(Math.sqrt(i)))
              ctx.strokeStyle = getColor("--md-sys-color-outline", "#00F");
            else
              ctx.strokeStyle = getColor(
                "--md-sys-color-outline-variant",
                "#0FF",
              );
            ctx.beginPath();
            ctx.arc(
              foreground.width / 2,
              foreground.height / 2,
              map(
                Math.sqrt(Math.max(Math.pow(i, 2) - Math.pow(z, 2), 0)),
                0,
                R,
                0,
                foreground.width / 2,
              ),
              0,
              2 * Math.PI,
            );
            ctx.stroke();
          }
          requestAnimationFrame(draw);
        });
      }
    },
    stop: () => {
      isActive = false;
    },
  };
}
