import type { RGBColor } from "@/scripts/utils/color/conversion.js";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { kernelGenerator } from "@/scripts/utils/dom/kernelGenerator.js";
import type { IKernelFunctionThis } from "@/scripts/utils/dom/kernelGenerator.ts";
import { startAnimationLoop, startLoop } from "@/scripts/utils/dom/utils.js";
import { map } from "@/scripts/utils/math/utils.js";
import { Vector } from "@/scripts/utils/math/vector.js";

import { Light } from "./colors.js";
import type { SceneObject } from "./object.ts";
import {
  postProcessorGen,
  reinhard_jodie_lum_ext as tonemaper,
} from "./postprocessor.js";
import { Ray, trace } from "./ray.js";
import { CAMERA_POSITION, FOCAL_LENGTH, FRAME_SIZE, SCENE } from "./scene.js";
import type { MessageResponse as WhiteMessageResponse } from "./worker_white.ts";

export default function execute() {
  let workers: Worker[] = [];
  const color = {
    white: [1, 1, 1] as RGBColor,
    bright: [1, 1, 1] as RGBColor,
  };
  let isActive = false;
  const scale = 1;

  let white_balance = true;
  let tone_mapping = true;

  const postProcessorGen_ = postProcessorGen(tonemaper);

  interface IConstants {
    FRAME_SIZE: [number, number];
    FOCAL_LENGTH: number;
    SCENE: SceneObject;
    CAMERA_POSITION: Vector;
  }

  function main(
    this: IKernelFunctionThis<IConstants>,
    acc: Light[][],
    iter: number,
    postProcessor: ReturnType<typeof postProcessorGen_>,
  ) {
    const [r, g, b] = postProcessor(
      acc[this.thread.x][this.thread.y]
        .mix(
          trace(
            new Ray(
              this.constants.CAMERA_POSITION,
              new Vector(
                map(
                  this.thread.x + Math.random() - 0.5,
                  0,
                  this.output.x,
                  -this.constants.FRAME_SIZE[0] / 2,
                  this.constants.FRAME_SIZE[0] / 2,
                ),
                map(
                  this.thread.y + Math.random() - 0.5,
                  0,
                  this.output.y,
                  -this.constants.FRAME_SIZE[1] / 2,
                  this.constants.FRAME_SIZE[1] / 2,
                ),
                this.constants.FOCAL_LENGTH,
              ),
            ),
            this.constants.SCENE,
          ),
        )
        .clone()
        .mult(1 / iter)
        .rgb(),
    );
    this.color(r, g, b, 1);
  }

  return {
    start: (canvas: HTMLCanvasElement, config: HTMLFormElement) => {
      isActive = true;
      tone_mapping =
        config.querySelector<HTMLInputElement>("#tone-mapping")!.checked;
      config
        .querySelector<HTMLInputElement>("#tone-mapping")!
        .addEventListener("change", (e) => {
          tone_mapping = (e.target as HTMLInputElement).checked;
        });
      white_balance =
        config.querySelector<HTMLInputElement>("#white-balance")!.checked;
      config
        .querySelector<HTMLInputElement>("#white-balance")!
        .addEventListener("change", (e) => {
          white_balance = (e.target as HTMLInputElement).checked;
        });

      const white_calc = new Worker(
        new URL("./worker_white.js", import.meta.url),
        { type: "module" },
      );
      white_calc.postMessage(null);
      white_calc.addEventListener(
        "message",
        function ({ data }: MessageEvent<WhiteMessageResponse>) {
          white_calc.postMessage(null);
          color.white = data.white;
          color.bright = data.bright;
        },
      );
      workers.push(white_calc);
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      })!;
      ctx.fillStyle = getPaletteBaseColor(0);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const buffer = ctx.getImageData(
        0,
        0,
        canvas.width / scale,
        canvas.height / scale,
        { colorSpace: "srgb" },
      );
      const acc = new Array(buffer.width)
        .fill(null)
        .map(() => new Array(buffer.height).fill(null).map(() => Light.black));
      let i = 0;
      const renderer = kernelGenerator(
        main,
        {
          FRAME_SIZE,
          FOCAL_LENGTH,
          SCENE,
          CAMERA_POSITION,
        },
        buffer,
      );
      startAnimationLoop(async function draw() {
        if (!isActive) return false;
        await createImageBitmap(buffer).then((bmp) =>
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height),
        );
        return true;
      });
      let step: Generator<void, void[][], never> | null = null;
      startLoop(function update() {
        if (!isActive) return false;
        const res = step?.next();
        if (!res || res.done) {
          step = renderer(
            acc,
            ++i,
            postProcessorGen_({
              bright: tone_mapping ? color.bright : [1, 1, 1],
              white: white_balance ? color.white : [1, 1, 1],
            }),
          );
        }
        return true;
      });
    },
    stop: () => {
      isActive = false;
      workers?.forEach((worker) => {
        worker.terminate();
      });
      workers = [];
    },
  };
}
