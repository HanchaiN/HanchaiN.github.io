import type { RGBColor } from "@/scripts/utils/color/conversion.ts";
import { clerp } from "@/scripts/utils/color/interpl.js";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { maxWorkers, startAnimationLoop } from "@/scripts/utils/dom/utils.js";

import { Light, toRGB } from "./colors.js";
import "./data/camera_response.json" with { type: "json" };
import "./data/light.json" with { type: "json" };
import "./data/material.json" with { type: "json" };
import { postProcessorGen, tone_mappers } from "./postprocessor.js";
import type { MessageRequest, MessageResponse } from "./worker.ts";
import type { MessageResponse as WhiteMessageResponse } from "./worker_white.ts";

export default function execute() {
  let workers: Worker[] = [];
  let isActive = false;
  const scale = 1;
  const chunkSize = 8;

  return {
    start: (canvas: HTMLCanvasElement, config: HTMLFormElement) => {
      isActive = true;
      const renderConfig = {
        postProcessor: (color: RGBColor) => color,
      };

      const render_size = {
        w: Math.round(canvas.width / scale),
        h: Math.round(canvas.height / scale),
      };
      const acc = new Array(render_size.w)
        .fill(null)
        .map(() => new Array(render_size.h).fill(null).map(() => Light.black));
      const iter = new Array(render_size.w)
        .fill(null)
        .map(() => new Array(render_size.h).fill(0));

      const render_queue: MessageRequest[] = [];
      for (let y0 = 0; y0 < render_size.h; y0 += chunkSize) {
        for (let x0 = 0; x0 < render_size.w; x0 += chunkSize) {
          render_queue.push({
            x0,
            x1: Math.min(x0 + chunkSize, render_size.w),
            y0,
            y1: Math.min(y0 + chunkSize, render_size.h),
            ...render_size,
          });
        }
      }
      workers = new Array(Math.ceil(Math.max(1, maxWorkers / 2 - 1)))
        .fill(null)
        .map(() => {
          const worker = new Worker(new URL("./worker.js", import.meta.url), {
            type: "module",
          });
          worker.addEventListener(
            "message",
            async function ({ data }: MessageEvent<MessageResponse>) {
              if (data !== null) {
                const { x0, y0, x1, y1, field } = data;
                render_queue.push({ x0, x1, y0, y1, ...render_size });
                requestIdleCallback(() => {
                  field.forEach((col, x) =>
                    col.forEach((pix, y) => {
                      acc[x0 + x][y0 + y].mix(new Light(pix));
                      iter[x0 + x][y0 + y]++;
                      buffer.data.set(
                        [
                          ...renderConfig
                            .postProcessor(
                              acc[x0 + x][y0 + y]
                                .clone()
                                .mult(1 / iter[x0 + x][y0 + y])
                                .rgb(),
                            )
                            .map((v) => v * 255),
                          255,
                        ],
                        4 *
                          ((buffer.height - y0 - y - 1) * render_size.w +
                            (x0 + x)),
                      );
                    }),
                  );
                });
              }
              let task = render_queue.shift();
              while (isActive && typeof task === "undefined") {
                await new Promise((resolve) => setTimeout(resolve, 0));
                task = render_queue.shift();
              }
              if (!isActive) return;
              worker.postMessage(task!);
            },
          );
          return worker;
        });

      const color = {
        light: [1, 1, 1] as RGBColor,
        wall: [1, 1, 1] as RGBColor,
      };
      const white_calc = new Worker(
        new URL("./worker_white.js", import.meta.url),
        { type: "module" },
      );
      white_calc.addEventListener(
        "message",
        function ({ data }: MessageEvent<WhiteMessageResponse>) {
          color.light = toRGB(data.light);
          color.wall = toRGB(data.wall);
          refreshPostProcessor();
        },
      );
      workers.push(white_calc);

      let white_balance = true;
      let white_ref: number = 0;
      let tone_mapping = true;
      let bright_ref: number = 1;
      let tone_mapper_key: string = "reinhard_jodie_lum_ext";
      function refreshPostProcessor() {
        renderConfig.postProcessor = postProcessorGen(
          tone_mappers[tone_mapper_key] ?? ((c) => c),
        )({
          bright: tone_mapping
            ? clerp(bright_ref, color.wall, color.light)
            : [1, 1, 1],
          white: white_balance
            ? clerp(white_ref, color.wall, color.light)
            : [1, 1, 1],
        });
      }

      white_balance =
        config.querySelector<HTMLInputElement>("#white-balance")!.checked;
      config
        .querySelector<HTMLInputElement>("#white-balance")!
        .addEventListener("change", (e) => {
          white_balance = (e.target as HTMLInputElement).checked;
          refreshPostProcessor();
        });
      white_ref = config.querySelector<HTMLInputElement>(
        "#white-balance-reference",
      )!.valueAsNumber;
      config
        .querySelector<HTMLInputElement>("#white-balance-reference")!
        .addEventListener("change", (e) => {
          white_ref = (e.target as HTMLInputElement).valueAsNumber;
          refreshPostProcessor();
        });
      tone_mapping =
        config.querySelector<HTMLInputElement>("#tone-mapping")!.checked;
      config
        .querySelector<HTMLInputElement>("#tone-mapping")!
        .addEventListener("change", (e) => {
          tone_mapping = (e.target as HTMLInputElement).checked;
          refreshPostProcessor();
        });
      bright_ref = config.querySelector<HTMLInputElement>(
        "#tone-mapping-reference",
      )!.valueAsNumber;
      config
        .querySelector<HTMLInputElement>("#tone-mapping-reference")!
        .addEventListener("change", (e) => {
          bright_ref = (e.target as HTMLInputElement).valueAsNumber;
          refreshPostProcessor();
        });
      tone_mapper_key =
        config.querySelector<HTMLSelectElement>("#tone-mapper")!.value;
      config
        .querySelector<HTMLSelectElement>("#tone-mapper")!
        .addEventListener("change", (e) => {
          tone_mapper_key = (e.target as HTMLSelectElement).value;
          refreshPostProcessor();
        });

      refreshPostProcessor();

      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      })!;
      ctx.fillStyle = getPaletteBaseColor(0);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const buffer = ctx.getImageData(0, 0, render_size.w, render_size.h, {
        colorSpace: "srgb",
      });
      startAnimationLoop(async function draw() {
        if (!isActive) return false;
        await createImageBitmap(buffer).then((bmp) =>
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height),
        );
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
