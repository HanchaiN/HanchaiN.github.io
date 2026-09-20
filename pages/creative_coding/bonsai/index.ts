import { Bonsai } from "./bonsai.js";
import { Canvas2DNCursesScreen, NCursesScreen } from "@/utils/ncurses.js";

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ncurses: NCursesScreen;
  let gen: Generator;
  let anim: number = -1;
  const scale = 4;

  function draw() {
    if (!canvas) return;
    const { done } = gen.next();
    ncurses.redraw();
    if (done) return redraw();
    anim = requestAnimationFrame(draw);
  }
  function redraw() {
    gen = new Bonsai(ncurses).start();
    ncurses.clear();
    ncurses.redraw();
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
      ncurses = new Canvas2DNCursesScreen(
        canvas.getContext("2d", { alpha: false, desynchronized: true })!,
        100,
        50,
      );
      canvas.addEventListener("click", redraw);
      redraw();
    },
    stop: () => {
      canvas?.remove();
      // canvas = ctx = null;
    },
  };
}
