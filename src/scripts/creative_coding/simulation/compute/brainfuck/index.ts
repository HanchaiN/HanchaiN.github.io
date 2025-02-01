import { getParentSize } from "@/scripts/utils/dom.js";
import p5 from "p5";
import { BrainfuckEngine } from "./bf.js";
export default function execute() {
  let parent: HTMLElement;
  let canvas: HTMLCanvasElement;
  let resizeObserver: ResizeObserver;

  const sketch = (p: p5) => {
    // Display
    const min_resolution = 10,
      max_resolution = 20; //px
    const graphicsResolution = 2;
    const _fr = 0; //fps
    const _viewrange = 50; //blocks
    let resolution = (min_resolution + max_resolution) / 2,
      viewrange = _viewrange;
    const sys = new BrainfuckEngine(
      "+[-->-[>>+>-----<<]<--<---]>-.>>>+.>>..+++[.>]<<<<.+++.------.<<-.>>>>+.",
    );
    const exec = sys.exec();
    let running = false;

    const v_pos = p.color(192);
    const v_neg = p.color(48);
    const v_a = p.color(0, 255, 0, 40);
    const v_b = p.color(0, 128, 0, 40);
    const v_ptr = p.color(255, 0, 0, 40);
    let output: p5.Element;
    let ram: p5.Image, ram_filter: p5.Image;

    function updateResolution() {
      const { width } = getParentSize(parent, canvas);
      viewrange = p.constrain(
        _viewrange,
        width / min_resolution,
        width / max_resolution,
      );
      resolution = width / viewrange;
    }
    function loadRam() {
      for (let i = -1; i <= sys.ram.length; i++) {
        const block = sys.ram.at(i % sys.ram.length)!;
        for (let j = 0; j < block.length; j++) {
          for (let x = 0; x < graphicsResolution; x++)
            for (let y = 0; y < graphicsResolution; y++)
              ram.set(
                (i + 1) * graphicsResolution + x,
                j * graphicsResolution + y,
                block[j] ? v_pos : v_neg,
              );
        }
      }
      ram.updatePixels();
    }
    function updateRam(index: number | null = null) {
      if (index === null) {
        updateRam(sys.ptr);
        if (sys.ptr === 0) updateRam(sys.ram.length);
        if (sys.ptr === sys.ram.length - 1) updateRam(-1);
        return;
      }
      const block = sys.ram.at(index % sys.ram.length)!;
      for (let j = 0; j < block.length; j++) {
        for (let x = 0; x < graphicsResolution; x++)
          for (let y = 0; y < graphicsResolution; y++)
            ram.set(
              (index + 1) * graphicsResolution + x,
              j * graphicsResolution + y,
              block[j] ? v_pos : v_neg,
            );
      }
      ram.updatePixels();
    }
    function loadRamFilter() {
      for (let i = 0; i < ram_filter.width / 2; i++) {
        ram_filter.set(
          ram_filter.width / 2 + i,
          0,
          Math.round(i / 6) % 2 === 0 ? v_a : v_b,
        );
        ram_filter.set(
          ram_filter.width / 2 - i,
          0,
          Math.round(i / 6) % 2 === 0 ? v_a : v_b,
        );
        if (i < 3) {
          ram_filter.set(ram_filter.width / 2 - i, 0, v_ptr);
          ram_filter.set(ram_filter.width / 2 + i, 0, v_ptr);
        }
      }
      ram_filter.updatePixels();
    }
    function parentResized() {
      const r = running;
      running = false;
      const { width } = getParentSize(parent, canvas);
      updateResolution();
      p.resizeCanvas(width, resolution * 15);
      ram_filter = p.createImage(6 * viewrange, 1);
      loadRamFilter();
      running = r;
      p.redraw();
    }
    p.setup = function () {
      const { width } = getParentSize(parent, canvas);
      updateResolution();
      p.createCanvas(width, resolution * 15);
      ram = p.createImage(
        (sys.ram.length + 2) * graphicsResolution,
        sys.ram[0].length * graphicsResolution,
      );
      loadRam();
      ram_filter = p.createImage(6 * viewrange, 1);
      if (_fr > 0) {
        p.frameRate(_fr);
      }
      running = true;
      output = p.createP("Output: ");
      resizeObserver = new ResizeObserver(parentResized);
      resizeObserver.observe(parent);
    };

    p.draw = function () {
      updateRam();
      p.background(0);
      p.imageMode(p.CORNER);
      p.image(
        ram,
        resolution * (viewrange / 2 - sys.ptr - sys.ram.length + 0.5),
        0,
        resolution * sys.ram.length,
        resolution * sys.ram[0].length,
        2 * graphicsResolution,
        0,
        sys.ram.length * graphicsResolution,
        ram.height,
      );
      p.image(
        ram,
        resolution * (viewrange / 2 - sys.ptr - 0.5 + sys.ram.length),
        0,
        resolution * sys.ram.length,
        resolution * sys.ram[0].length,
        1 * graphicsResolution,
        0,
        sys.ram.length * graphicsResolution,
        ram.height,
      );
      p.image(
        ram,
        resolution * (viewrange / 2 - sys.ptr),
        0,
        resolution * sys.ram.length,
        resolution * sys.ram[0].length,
        1.5 * graphicsResolution,
        0,
        sys.ram.length * graphicsResolution,
        ram.height,
      );
      p.imageMode(p.CENTER);
      p.image(
        ram_filter,
        (resolution * viewrange) / 2,
        resolution * 4,
        resolution * viewrange,
        resolution * 8,
        0,
        0,
        ram_filter.width,
        ram_filter.height,
      );
      p.textSize(resolution * 5);
      p.textAlign(p.CENTER, p.CENTER);
      for (let i = Math.floor(viewrange / 2) % 5; i <= viewrange + 10; i += 5) {
        const index = (i - Math.floor(viewrange / 2)) / 5 + sys.pptr;
        const command =
          index < 0 || index > sys.prog.length - 1 ? "" : sys.prog[index];
        p.fill(i % 2 === 0 ? v_neg : v_pos);
        p.text(command, resolution * (i - 5), resolution * 11.5);
        p.fill(sys.pptr + 1 === index ? v_ptr : v_a);
        p.rect(resolution * (i - 7.5), resolution * 9, resolution * 5);
      }
      if (running) {
        const res = exec.next();
        if (res.done) {
          p.noLoop();
          running = false;
        }
        if (res.value === "INPUT") {
          exec.next(0);
        } else if (typeof res.value === "number") {
          output.html(output.html() + String.fromCharCode(res.value));
        }
      }
    };
  };

  interface p5Extension extends p5 {
    canvas: HTMLCanvasElement;
  }
  let instance: p5Extension;
  return {
    start: (node: HTMLElement) => {
      parent = node;
      instance = new p5(sketch, parent) as p5Extension;
      canvas ??= instance.canvas;
    },
    stop: () => {
      instance?.remove();
      canvas?.remove();
      resizeObserver?.disconnect();
      // parent = canvas = instance = resizeObserver = null;
    },
  };
}
