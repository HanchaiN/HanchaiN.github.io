import { getColor, maxWorkers } from "@/script/utils/dom";
import { Vector, constrainMap } from "@/script/utils/math";
import * as d3 from "d3-color";
// import { WorkerPool } from "gatsby-worker";
import type { MessageResponse } from "./worker";
export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let workers: Worker[];
  let isActive = false;
  let background: d3.Color;
  const param = {
    rho: 28,
    sigma: 10,
    beta: 8 / 3,
  };
  const err = 1e-5;
  const count = 2048;
  const time_scale = 5e-4;

  function setup() {
    if (!canvas) return;
    background = getColor("--md-sys-color-surface", "#000");
    ctx.lineWidth = 0;
    ctx.fillStyle = background.formatHex8();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  async function draw(time: number) {
    if (!isActive) return;
    const aspect = canvas.width / canvas.height;
    const center = new Vector(0, 0, param.rho - 1),
      limit = new Vector(
        3 * Math.sqrt(param.beta * (param.rho - 1)),
        3 * Math.sqrt(param.beta * (param.rho - 1)),
        3 * Math.sqrt(param.beta * (param.rho - 1)),
      );
    function project(...val: number[]) {
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
    const result = await Promise.all(
      workers.map((worker) => {
        return new Promise<MessageResponse>((resolve) => {
          worker.postMessage({ time });
          worker.addEventListener("message", function listener({ data }) {
            resolve(data);
            worker.removeEventListener("message", listener);
          });
        });
      }),
    );
    const r = 1;
    ctx.lineWidth = 0;
    ctx.fillStyle = background.formatHex8();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    result.forEach(({ states }) => {
      states!.forEach(({ state, color }) => {
        const pos = project(...state);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
    requestAnimationFrame(draw);
  }

  return {
    start: (sketch: HTMLCanvasElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false })!;
      setup();
      workers = new Array(maxWorkers)
        .fill(null)
        .map(() => new Worker(new URL("./worker.ts", import.meta.url)));
      workers.forEach((worker, i) => {
        const index =
          i * Math.floor(count / maxWorkers) +
          Math.min(i, count % maxWorkers),
          counts =
            Math.floor(count / maxWorkers) + (i < count % maxWorkers ? 1 : 0);
        const states = new Array(counts).fill(null).map((_, i) => ({
          state: [[constrainMap(index + i, 0, count, -err, +err), 2, 20]],
          color: d3
            .cubehelix(
              constrainMap(index + i, 0, count, 0, 360),
              0.75 * 2,
              Number.parseInt(
                getComputedStyle(document.body).getPropertyValue(
                  "--tone-on-surface-variant",
                ),
              ) / 100,
            )
            .formatHex8(),
        }));
        worker.postMessage({ time_scale, param, states });
        worker.addEventListener("message", function listener() {
          worker.removeEventListener("message", listener);
        });
      });
      isActive = true;
      requestAnimationFrame(draw);
    },
    stop: () => {
      isActive = false;
      canvas?.remove();
      workers?.forEach((worker) => worker.terminate());
      // workers = canvas = null;
    },
  };
}
