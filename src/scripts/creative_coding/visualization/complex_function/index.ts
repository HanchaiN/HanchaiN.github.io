import convert_color from "@/scripts/utils/color/conversion.js";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { kernelGenerator } from "@/scripts/utils/dom/kernelGenerator.js";
import type { IKernelFunctionThis } from "@/scripts/utils/dom/kernelGenerator.ts";
import { startAnimationLoop, startLoop } from "@/scripts/utils/dom/utils.js";
import { complex_absSq, complex_zeta } from "@/scripts/utils/math/complex.js";
import type { TComplex } from "@/scripts/utils/math/complex.ts";
import { fpart, map } from "@/scripts/utils/math/utils.js";

const hcl2srgb = convert_color("hcl", "srgb")!;

export default function execute() {
  const R = 20;
  const iter = 500;
  let isActive: boolean = false;
  const l0 = 0.25;
  const l1 = 0.75;
  const s0 = 0.125;
  const s1 = 0.25;
  function f(z: TComplex) {
    return complex_zeta(z);
  }

  interface IConstants {
    R: number;
    s0: number;
    l0: number;
    s1: number;
    l1: number;
  }

  function main(this: IKernelFunctionThis<IConstants>) {
    const re = map(
      this.thread.x / this.output.x,
      0,
      1,
      -this.constants.R,
      +this.constants.R,
    );
    const im = map(
      this.thread.y / this.output.y,
      0,
      1,
      -this.constants.R,
      +this.constants.R,
    );
    const z = f([re, im]);
    const r = Math.sqrt(complex_absSq(z));
    const theta = Math.atan2(z[1], z[0]);
    const hue = (theta < 0.0 ? theta + 2 * Math.PI : theta) / (Math.PI * 2);
    const sat = map(
      fpart(Math.log2(r)) * fpart((-theta * 12) / (Math.PI * 2)),
      0,
      1,
      this.constants.s0,
      this.constants.s1,
    );
    const lum = map(
      1 - 1 / (Math.pow(r, Math.log10(3)) + 1),
      0,
      1,
      this.constants.l0,
      this.constants.l1,
    );
    const c = hcl2srgb([hue, sat, lum]);
    this.color(c[0], c[1], c[2], 1);
  }
  return {
    start: (canvas: HTMLCanvasElement) => {
      isActive = true;
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      })!;
      ctx.fillStyle = getPaletteBaseColor(0);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const buffer = ctx.getImageData(0, 0, canvas.width, canvas.height, {
        colorSpace: "srgb",
      });
      const renderer = kernelGenerator(main, { R, l0, l1, s0, s1 }, buffer);
      const step = renderer();
      let done = false;
      startAnimationLoop(async function draw() {
        if (!isActive) return false;
        await createImageBitmap(buffer).then((bmp) =>
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height),
        );
        return !done;
      });
      startLoop(function update() {
        if (!isActive) return true;
        for (let _ = 0; _ < iter; _++) {
          const res = step.next();
          if (res.done) {
            done = true;
            break;
          }
        }
        return !done;
      });
    },
    stop: () => {
      isActive = false;
    },
  };
}
