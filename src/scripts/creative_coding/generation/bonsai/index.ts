import { Bonsai } from "./bonsai.js";
import { NCursesScreen } from "./ncurses.js";

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let ncurses: NCursesScreen;
  let gen: Generator;
  let anim: number = -1;
  const scale = 4;

  function draw() {
    if (!canvas) return;
    const { done } = gen.next();
    ncurses.update(ctx);
    if (done) return redraw();
    anim = requestAnimationFrame(draw);
  }
  function redraw() {
    gen = new Bonsai(ncurses).start();
    ncurses.clear();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (anim !== -1) cancelAnimationFrame(anim);
    anim = requestAnimationFrame(draw);
  }
  return {
    start: (sketch: HTMLCanvasElement) => {
      canvas = sketch;
      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
      canvas.width = Math.round(canvas.width * scale);
      canvas.height = Math.round(canvas.height * scale);
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      ncurses = new NCursesScreen(100, 50);
      canvas.addEventListener("click", redraw);
      redraw();
    },
    stop: () => {
      canvas?.remove();
      // canvas = ctx = null;
    },
  };
}
