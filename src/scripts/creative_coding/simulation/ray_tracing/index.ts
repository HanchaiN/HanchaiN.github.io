import type { RGBColor } from "@/scripts/utils/color/conversion.ts";
import { clerp } from "@/scripts/utils/color/interpl.js";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import {
  CheckDisplay,
  SelectDisplay,
} from "@/scripts/utils/dom/element/SelectDisplay.js";
import { maxWorkers, startAnimationLoop } from "@/scripts/utils/dom/utils.js";
import { throttle } from "@/scripts/utils/utils.js";

import { LightAccumulator } from "./colors.js";
import "./data/camera_response.json" with { type: "json" };
import "./data/light.json" with { type: "json" };
import "./data/material.json" with { type: "json" };
import { postProcessorGen, tone_mappers } from "./postprocessor.js";
import { REF_ILLUM, default_mode, toRGB } from "./spectrum.js";
import type { CMapMode, CMaxMode, CRefIllum, TSpectrum } from "./spectrum.ts";
import type { MessageRequest, MessageResponse } from "./worker.ts";
import type { MessageResponse as WhiteMessageResponse } from "./worker_white.ts";

export default function execute() {
  let workers: Worker[] = [];
  let isActive = false;
  const scale = 5;
  const chunkSize = 8;

  return {
    start: (canvas: HTMLCanvasElement, config: HTMLFormElement) => {
      isActive = true;
      const render_size = {
        w: Math.round(canvas.width / scale),
        h: Math.round(canvas.height / scale),
      };
      const renderConfig = {
        postProcessor: (color: RGBColor) => color,
        ref: {
          white: 0 as CRefIllum | number | null,
          bright: 0 as CRefIllum | number | null,
          light: null as TSpectrum | null,
          wall: null as TSpectrum | null,
        },
        c_mode: structuredClone(default_mode),
        tone_mapper_key: "reinhard_jodie_lum_ext",
      };
      const refreshPostProcessor = throttle(async () => {
        async function getRef(
          r: CRefIllum | number | null,
          c0: RGBColor = [1, 1, 1],
        ): Promise<RGBColor> {
          return r === null
            ? c0
            : r in REF_ILLUM
              ? await toRGB(REF_ILLUM[r as CRefIllum]!, renderConfig.c_mode)
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
          tone_mappers[renderConfig.tone_mapper_key] ?? ((c) => c),
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
                requestIdleCallback(
                  async () => {
                    await Promise.all(
                      field
                        .map((col, x) =>
                          col.map(async (pix, y) => {
                            acc[x0 + x][y0 + y].accumulate(pix);
                            buffer.data.set(
                              [
                                ...renderConfig
                                  .postProcessor(
                                    await acc[x0 + x][y0 + y].rgb(
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

      const white_calc = new Worker(
        new URL("./worker_white.js", import.meta.url),
        { type: "module" },
      );
      white_calc.addEventListener(
        "message",
        function ({ data }: MessageEvent<WhiteMessageResponse>) {
          renderConfig.ref.light = data.light;
          renderConfig.ref.wall = data.wall;
          refreshPostProcessor();
        },
      );
      workers.push(white_calc);

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
          if (r.value in REF_ILLUM) return r.value as CRefIllum;
          return itpl.valueAsNumber;
        }
        const wb = new CheckDisplay(
          config.querySelector<HTMLInputElement>("#white-balance")!,
          config.querySelector<HTMLElement>("#white-balance-options")!,
        );
        const wb_r = new SelectDisplay<CRefIllum | "Wall-Light">(
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
