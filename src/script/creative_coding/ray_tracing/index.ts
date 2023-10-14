import { getColor, kernelGenerator } from "@/script/utils/dom";
import { Vector, map } from "@/script/utils/math";
import type { IKernelFunctionThis } from "@/script/utils/types";
import type { TColorRGB } from "./colors";
import { Light } from "./colors";
import type { SceneObject } from "./object";
import {
  postProcessorGen,
  reinhard_jodie_lum_ext as tonemaper,
} from "./postprocessor";
import { Ray, trace } from "./ray";
import { CAMERA_POSITION, FOCAL_LENGTH, FRAME_SIZE, SCENE } from "./scene";
import type { MessageResponse as WhiteMessageResponse } from "./worker_white";

export default function execute() {
  let workers: Worker[] = [];
  const color = {
    white: [1, 1, 1] as TColorRGB,
    bright: [1, 1, 1] as TColorRGB,
  };
  let isActive = false;
  const scale = 1;

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
    start: (canvas: HTMLCanvasElement) => {
      isActive = true;
      const white_calc = new Worker(
        new URL("./worker_white.ts", import.meta.url),
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
      ctx.fillStyle = getColor("--md-sys-color-surface", "#000").formatHex8();
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const buffer = ctx.getImageData(
        0,
        0,
        canvas.width / scale,
        canvas.height / scale,
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
      let step = renderer(
        acc,
        ++i,
        postProcessorGen_(color.bright, color.white),
      );
      requestAnimationFrame(function draw() {
        if (!isActive) return;
        createImageBitmap(buffer).then((bmp) =>
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height),
        );
        requestAnimationFrame(draw);
      });
      requestIdleCallback(function update() {
        if (!isActive) return;
        const res = step.next();
        if (res.done) {
          step = renderer(
            acc,
            ++i,
            postProcessorGen_(color.bright, color.white),
          );
        }
        requestIdleCallback(update);
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
