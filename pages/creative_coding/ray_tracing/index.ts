import type { RGBColor } from "@/utils/color/conversion.ts";
import { clerp } from "@/utils/color/interpl.js";
import { getPaletteBaseColor } from "@/utils/color/palette.js";
import {
  CheckDisplay,
  SelectDisplay,
} from "@/utils/dom/element/SelectDisplay.js";
import { startAnimationLoop } from "@/utils/dom/utils.js";
import {
  maxWorkers,
  workerLoader,
  TaskWorkerWrapper,
} from "@/utils/dom/worker/index.js";
import { throttle } from "@/utils/utils.js";

import { LightAccumulator } from "./colors.js";
import "./data/camera_response.json" with { type: "json" };
import "./data/light.json" with { type: "json" };
import "./data/material.json" with { type: "json" };
import { postProcessorGen, tone_mappers } from "./postprocessor.js";
import { REF_ILLUM, default_mode, toRGB } from "./spectrum.js";
import type {
  CMapMode,
  CMaxMode,
  CRefIllum,
  CRefIllum_Strict,
  TSpectrum,
} from "./spectrum.ts";
import type { MessageRequest, MessageResponse } from "./worker.ts";
import type {
  MessageRequest as WhiteMessageRequest,
  MessageResponse as WhiteMessageResponse,
} from "./worker_white.ts";
import {
  OrderedPriorityQueue,
  type IBasePriorityQueue,
} from "@/utils/algo/datastructure.js";

export default function execute() {
  let workers: TaskWorkerWrapper<MessageRequest, MessageResponse>[] = [];
  let white_worker: Worker | null = null;
  let isActive = false;
  const scale = 1;
  const chunkSize = 8;

  return {
    start: async (canvas: HTMLCanvasElement, config: HTMLFormElement) => {
      isActive = true;
      const render_size = {
        w: Math.round(canvas.width / scale),
        h: Math.round(canvas.height / scale),
      };
      const renderConfig = {
        postProcessor: (color: RGBColor) => color,
        ref: {
          white: 0 as CRefIllum_Strict | number | null,
          bright: 0 as CRefIllum_Strict | number | null,
          light: null as TSpectrum | null,
          wall: null as TSpectrum | null,
        },
        c_mode: structuredClone(default_mode),
        tone_mapper_key: "reinhard_jodie_lum_ext",
      };
      const refreshPostProcessor = throttle(async () => {
        async function getRef(
          r: CRefIllum_Strict | number | null,
          c0: RGBColor = [1, 1, 1],
        ): Promise<RGBColor> {
          return r === null
            ? c0
            : r in REF_ILLUM
              ? await toRGB(
                  REF_ILLUM[r as CRefIllum_Strict]!,
                  renderConfig.c_mode,
                )
              : renderConfig.ref.wall !== null &&
                  renderConfig.ref.light !== null
                ? clerp(
                    r as number,
                    await toRGB(renderConfig.ref.wall, renderConfig.c_mode),
                    await toRGB(renderConfig.ref.light, renderConfig.c_mode),
                    "rgb",
                    "lab",
                  )
                : c0;
        }
        renderConfig.postProcessor = postProcessorGen(
          tone_mappers[renderConfig.tone_mapper_key]! ?? ((c) => c),
        )({
          white: await getRef(renderConfig.ref.white),
          bright: await getRef(renderConfig.ref.bright),
        });
      }, 500);

      const acc = new Array(render_size.w)
        .fill(null)
        .map(() =>
          new Array(render_size.h).fill(null).map(() => new LightAccumulator()),
        );

      {
        renderConfig.c_mode.mode = config.querySelector<HTMLSelectElement>(
          "#color-mapping",
        )!.value as CMapMode;
        config
          .querySelector<HTMLSelectElement>("#color-mapping")!
          .addEventListener("change", (e) => {
            renderConfig.c_mode.mode = (e.target as HTMLSelectElement)
              .value as CMapMode;
          });
        renderConfig.c_mode.max_ref = config.querySelector<HTMLSelectElement>(
          "#spectrum-ref",
        )!.value as CRefIllum;
        config
          .querySelector<HTMLSelectElement>("#spectrum-ref")!
          .addEventListener("change", (e) => {
            renderConfig.c_mode.max_ref = (e.target as HTMLSelectElement)
              .value as CRefIllum;
          });
        renderConfig.c_mode.max_mode = config.querySelector<HTMLSelectElement>(
          "#channel-ref",
        )!.value as CMaxMode;
        config
          .querySelector<HTMLSelectElement>("#channel-ref")!
          .addEventListener("change", (e) => {
            renderConfig.c_mode.max_mode = (e.target as HTMLSelectElement)
              .value as CMaxMode;
          });

        function getRef(
          check: CheckDisplay,
          r: SelectDisplay,
          itpl: HTMLInputElement,
        ) {
          if (!check.value) return null;
          if (r.value in REF_ILLUM) return r.value as CRefIllum_Strict;
          return itpl.valueAsNumber;
        }
        const wb = new CheckDisplay(
          config.querySelector<HTMLInputElement>("#white-balance")!,
          config.querySelector<HTMLElement>("#white-balance-options")!,
        );
        const wb_r = new SelectDisplay<CRefIllum_Strict | "Wall-Light">(
          wb.container.querySelector<HTMLSelectElement>(
            "#white-balance-reference",
          )!,
          wb.container.querySelector<HTMLElement>(
            "#white-balance-reference-container",
          )!,
        );
        const wbr_itpl = wb_r.container.querySelector<HTMLInputElement>(
          "#white-balance-reference-itpl",
        )!;
        function updateWRef() {
          renderConfig.ref.white = getRef(wb, wb_r, wbr_itpl);
          refreshPostProcessor();
        }

        wb.target.addEventListener("change", updateWRef);
        wb_r.target.addEventListener("change", updateWRef);
        wbr_itpl.addEventListener("change", updateWRef);
        updateWRef();

        const tm = new CheckDisplay(
          config.querySelector<HTMLInputElement>("#tone-mapping")!,
          config.querySelector<HTMLElement>("#tone-mapping-options")!,
        );
        const tm_r = new SelectDisplay<string>(
          tm.container.querySelector<HTMLSelectElement>(
            "#tone-mapping-reference",
          )!,
          tm.container.querySelector<HTMLElement>(
            "#tone-mapping-reference-container",
          )!,
        );
        const tmr_itpl = tm_r.container.querySelector<HTMLInputElement>(
          "#tone-mapping-reference-itpl",
        )!;
        function updateTRef() {
          renderConfig.ref.bright = getRef(tm, tm_r, tmr_itpl);
          refreshPostProcessor();
        }
        tm.target.addEventListener("change", updateTRef);
        tm_r.target.addEventListener("change", updateTRef);
        tmr_itpl.addEventListener("change", updateTRef);
        updateTRef();

        const tm_k =
          tm.container.querySelector<HTMLSelectElement>("#tone-mapper")!;
        tm_k.addEventListener("change", (e) => {
          renderConfig.tone_mapper_key = (e.target as HTMLSelectElement).value;
          refreshPostProcessor();
        });
        tm_k.dispatchEvent(new Event("change"));
      }

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
        ctx.putImageData(buffer, 0, 0);
        return true;
      });

      {
        const render_queue: IBasePriorityQueue<
          MessageRequest & { priority?: number }
        > = new OrderedPriorityQueue((e) => {
          if (typeof e.priority !== "undefined") return e.priority;
          const { x0, y0, x1, y1 } = e;
          const w = x1 - x0;
          const h = y1 - y0;
          const low = w * h;
          const min = (low * (w * h)) / 2;
          let p = 0;
          for (let x = 0; x < w; x++) {
            if (p < -min) break;
            for (let y = 0; y < h; y++) {
              if (p < -min) break;
              const a = acc[x0 + x]![y0 + y]!;
              if (a.n < 10) {
                p -= low;
                continue;
              }
              p += Math.min(1, (0.01 + 0.05 * Math.abs(a.avg)) / a.se);
            }
          }
          return (e.priority = p);
        });
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
        workers = await Promise.all(
          new Array(Math.ceil(Math.max(1, maxWorkers - 1)))
            .fill(null)
            .map(async () => {
              const worker = new TaskWorkerWrapper<
                MessageRequest,
                MessageResponse
              >(new URL("./worker.js", import.meta.url));
              await worker.initialize(true);
              return worker;
            }),
        );
        workers.map(async function eventLoop(worker) {
          let _qe;
          do {
            await new Promise((resolve) => setTimeout(resolve, 0));
            if (!isActive) return;
            _qe = render_queue.pop();
          } while (_qe === null);
          const { priority: _, ..._task } = _qe;
          const task = _task as MessageRequest;
          worker.push(task);
          let data;
          try {
            data = await worker.wait();
          } catch (e) {
            console.error(e);
            render_queue.push(task);
            return;
          }
          setTimeout(() => eventLoop(worker), 0);
          const { param, field } = data;
          render_queue.push(param);
          const { x0, y0 } = param;
          requestIdleCallback(
            async () => {
              await Promise.all(
                field
                  .map((col, x) =>
                    col.map(async (pix, y) => {
                      acc[x0 + x]![y0 + y]!.accumulate(pix);
                      buffer.data.set(
                        [
                          ...renderConfig
                            .postProcessor(
                              await acc[x0 + x]![y0 + y]!.rgb(
                                renderConfig.c_mode,
                              ),
                            )
                            .map((v) => v * 255),
                          255,
                        ],
                        4 *
                          ((buffer.height - y0 - y - 1) * render_size.w +
                            (x0 + x)),
                      );
                    }),
                  )
                  .flat(),
              );
            },
            { timeout: 1000 },
          );
        });
      }

      {
        white_worker = await workerLoader(
          new URL("./worker_white.js", import.meta.url).toString(),
        );
        white_worker.addEventListener("error", () =>
          console.error("Error initializing worker"),
        );
        white_worker.addEventListener(
          "message",
          function ({ data }: MessageEvent<WhiteMessageResponse>) {
            renderConfig.ref.light = data.light;
            renderConfig.ref.wall = data.wall;
            refreshPostProcessor();
          },
        );
      }
    },
    stop: () => {
      isActive = false;
      workers?.forEach((worker) => {
        worker.terminate();
      });
      white_worker?.postMessage({ active: isActive } as WhiteMessageRequest);
      white_worker?.terminate();
      workers = [];
    },
  };
}
