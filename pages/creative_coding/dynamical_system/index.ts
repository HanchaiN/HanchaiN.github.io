import convert_color from "@/utils/color/conversion.js";
import { getPaletteBaseColor } from "@/utils/color/palette.js";
import {
  startAnimationLoop,
  startLoop,
} from "@/utils/dom/utils.js";
import { maxWorkers } from "@/utils/dom/worker/index.js";
import { WorkerWrapper } from "@/utils/dom/worker/index.js";
import { constrainMap } from "@/utils/math/utils.js";
import { Vector } from "@/utils/math/vector.js";

import type { MessageRequest, MessageResponse } from "./worker.js";

const hcl2hex = convert_color("hcl", "hex")!;

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let workers: WorkerWrapper<MessageRequest, MessageResponse>[];
  let isActive = false;
  const getBackground = () => getPaletteBaseColor(0);
  const param = {
    rho: 28,
    sigma: 10,
    beta: 8 / 3,
  };
  const err = 1e-5;
  const count = 2048;
  const time_scale = 5e-4;
  let result: MessageResponse[] = [];

  function setup() {
    if (!canvas) return;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  async function update(time: number) {
    if (!isActive) return false;
    result = await Promise.all(
      workers.map((worker) => worker.execute({ time })),
    );
    return true;
  }

  function project(...val: number[]) {
    const aspect = canvas.width / canvas.height;
    const center = new Vector(0, 0, param.rho - 1),
      limit = new Vector(
        3 * Math.sqrt(param.beta * (param.rho - 1)),
        3 * Math.sqrt(param.beta * (param.rho - 1)),
        3 * Math.sqrt(param.beta * (param.rho - 1)),
      );
    const p = (v: Vector) => new Vector(v.x, v.y);
    const pos = p(new Vector(...val).sub(center));
    const lim = p(limit);
    return new Vector(
      constrainMap(
        pos.x,
        -Math.max(lim.x, lim.y * aspect),
        +Math.max(lim.x, lim.y * aspect),
        0,
        canvas.width,
      ),
      constrainMap(
        pos.y,
        +Math.max(lim.y, lim.x / aspect),
        -Math.max(lim.y, lim.x / aspect),
        0,
        canvas.height,
      ),
    );
  }
  function draw() {
    const r = 1;
    ctx.lineWidth = 0;
    ctx.fillStyle = getBackground();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    result.forEach(({ states }) => {
      states!.forEach(({ state, hue }) => {
        const pos = project(...state);
        ctx.fillStyle = hcl2hex([hue / 360, 0.125, 0.75]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
    return true;
  }

  return {
    start: async (sketch: HTMLCanvasElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false })!;
      setup();
      workers = await Promise.all(new Array(maxWorkers).fill(null).map(
        async () => {
          const worker = new WorkerWrapper<MessageRequest, MessageResponse>(new URL("./worker.js", import.meta.url))
          await worker.initialize(true);
          return worker;
        }
      ));
      await Promise.all(workers.map(async (worker, i, a) => {
        const index =
            i * Math.floor(count / a.length) +
            Math.min(i, count % a.length),
          counts =
            Math.floor(count / a.length) + (i < count % a.length ? 1 : 0);
        const states = new Array(counts).fill(null).map((_, i) => ({
          state: [[constrainMap(index + i, 0, count, -err, +err), 2, 20]],
          hue: constrainMap(index + i, 0, count, 0, 360),
        }));
        await worker.initialize(true);
        return await worker.execute({time_scale, param, states});
      }));
      isActive = true;
      startAnimationLoop(draw);
      startLoop(update);
    },
    stop: () => {
      isActive = false;
      canvas?.remove();
      workers?.forEach((worker) => worker.terminate());
      // workers = canvas = null;
    },
  };
}
