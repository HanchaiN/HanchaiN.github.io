import convert_color from "@/scripts/utils/color/conversion.js";
import type { LABColor } from "@/scripts/utils/color/conversion.ts";
import {
  DistanceCMC,
  DistanceE00,
  DistanceE94,
  DistanceEab,
  DistanceHyAB,
  DistanceRedMean,
} from "@/scripts/utils/color/distance.js";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { PaletteInput } from "@/scripts/utils/dom/element/PaletteInput.js";
import { kernelGenerator } from "@/scripts/utils/dom/kernelGenerator.js";
import type { IKernelFunctionThis } from "@/scripts/utils/dom/kernelGenerator.ts";
import { startAnimationLoop, startLoop } from "@/scripts/utils/dom/utils.js";
import { map } from "@/scripts/utils/math/utils.js";

const lab2srgb = convert_color("lab", "srgb")!,
  str2lab = convert_color("str", "lab")!,
  lab2hex = convert_color("lab", "hex")!;

export default function execute() {
  const iter = 10000;
  let isActive: boolean = false;
  let step: Generator<void, void[][], void> | null = null;
  const c_max: number = 1;
  let l: number = 0.5;
  let e1: number = 0.02,
    e2: number = 0.05;
  let bound: boolean = true;
  let snap_l: boolean = false;
  let snap_c: number | null = null;
  let buffer: ImageData;
  let palette: PaletteInput;
  const distance_fn: { [key: string]: (c1: LABColor, c2: LABColor) => number } =
    {
      "red-mean": (c1, c2) => DistanceRedMean(lab2srgb(c1), lab2srgb(c2)),
      "hybrid-ab": DistanceHyAB,
      cie76: DistanceEab,
      "cie2:1": (c1, c2) => DistanceCMC(c1, c2, { l: 2, c: 1 }),
      "cie1:1": (c1, c2) => DistanceCMC(c1, c2, { l: 1, c: 1 }),
      "cie94-graphics": (c1, c2) =>
        DistanceE94(c1, c2, { k1: 4.5, k2: 1.5, kL: 1, kC: 1, kH: 1 }),
      "cie94-textiles": (c1, c2) =>
        DistanceE94(c1, c2, { k1: 4.8, k2: 1.4, kL: 2, kC: 1, kH: 1 }),
      cie00: DistanceE00,
    };

  interface IConstants {
    c_max: number;
  }
  interface IParameters {
    l: number;
    e1: number;
    e2: number;
    bound: boolean;
    c0: LABColor[];
  }

  function remapColor(col: LABColor): LABColor {
    let [l0, a0, b0] = col;
    if (snap_l) l0 = l;
    if (snap_c !== null) {
      const c0 = Math.sqrt(a0 ** 2 + b0 ** 2);
      if (c0 === 0) {
        a0 = 0;
        b0 = 0;
      }
      a0 *= snap_c / c0;
      b0 *= snap_c / c0;
    }
    return [l0, a0, b0];
  }
  function getMain(
    distance_i: (c1: LABColor, c2: LABColor) => number,
    distance_o: (c1: LABColor, c2: LABColor) => number,
  ) {
    function main(
      this: IKernelFunctionThis<IConstants>,
      { l, e1, e2, bound, c0 }: IParameters,
    ) {
      const a = map(
        this.thread.x / this.output.x,
        0,
        1,
        -this.constants.c_max,
        +this.constants.c_max,
      );
      const b = map(
        this.thread.y / this.output.y,
        0,
        1,
        -this.constants.c_max,
        +this.constants.c_max,
      );
      let d_min = Infinity;
      let is_range = false;
      for (const col of c0) {
        const col_ = remapColor(col);
        const d_i = distance_i([l, a, b], col_),
          d_o = distance_o([l, a, b], col_);
        is_range ||= d_o <= e2 && e1 <= d_i;
        d_min = Math.min(d_i, d_min);
      }
      const c = lab2srgb(bound === is_range ? [d_min, 0, 0] : [l, a, b]);
      this.color(c[0], c[1], c[2], 1);
    }
    return main;
  }
  function redraw(
    distance_i: (c1: LABColor, c2: LABColor) => number,
    distance_o: (c1: LABColor, c2: LABColor) => number,
  ) {
    if (!isActive) return;
    const main = getMain(distance_i, distance_o);
    const renderer = kernelGenerator(main, { c_max }, buffer);

    step = renderer({
      l,
      e1,
      e2,
      bound,
      c0: palette.value.map((c) => str2lab(c)),
    });
  }
  return {
    start: (canvas: HTMLCanvasElement, config: HTMLFormElement) => {
      isActive = true;
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      })!;
      palette = new PaletteInput(
        config.querySelector("#palette")!,
        config.querySelector("#palette-text")!,
      );
      ctx.fillStyle = getPaletteBaseColor(0);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      buffer = ctx.getImageData(0, 0, canvas.width, canvas.height, {
        colorSpace: "srgb",
      });
      config
        .querySelector<HTMLButtonElement>("#apply")!
        .addEventListener("click", () => {
          l =
            config.querySelector<HTMLInputElement>("#lightness")!.valueAsNumber;
          e1 =
            config.querySelector<HTMLInputElement>("#range-i")!.valueAsNumber;
          e2 =
            config.querySelector<HTMLInputElement>("#range-o")!.valueAsNumber;
          snap_l =
            config.querySelector<HTMLInputElement>("#snap-lightness")!.checked;
          snap_c = config.querySelector<HTMLInputElement>("#snap-chroma")!
            .checked
            ? config.querySelector<HTMLInputElement>("#chroma")!.valueAsNumber
            : null;
          bound = config.querySelector<HTMLInputElement>("#bound")!.checked;
          const _distance_i =
              config.querySelector<HTMLSelectElement>("#algorithm-i")!.value,
            _distance_o =
              config.querySelector<HTMLSelectElement>("#algorithm-o")!.value;
          const distance_i = distance_fn[_distance_i],
            distance_o =
              _distance_o === "inner" ? distance_i : distance_fn[_distance_o];
          redraw(distance_i, distance_o);
        });
      startAnimationLoop(async function draw() {
        if (!isActive) return false;
        await createImageBitmap(buffer).then((bmp) => {
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
          for (const c of palette.value) {
            const [l0, a0, b0] = remapColor(str2lab(c));
            ctx.fillStyle = lab2hex([l0, a0, b0]);
            ctx.strokeStyle = l < 0.5 ? "#fff" : "#000";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(
              map(a0, -c_max, +c_max, 0, canvas.width),
              map(b0, +c_max, -c_max, 0, canvas.height),
              2,
              0,
              2 * Math.PI,
            );
            ctx.fill();
            ctx.stroke();
            ctx.closePath();
          }
        });
        return true;
      });
      startLoop(function update() {
        if (!isActive) return false;
        if (step !== null) {
          for (let _ = 0; _ < iter; _++) {
            const res = step.next();
            if (res.done) {
              step = null;
              break;
            }
          }
        }
        return true;
      });
    },
    stop: () => {
      isActive = false;
    },
  };
}
