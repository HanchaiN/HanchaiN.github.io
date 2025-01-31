import p5 from "p5";
import { CA } from "./ca.js";
import { BinaryToGray } from "./gray.js";
import type { p5Extension } from "@/scripts/utils/types.ts";
export default function execute() {
  let parent: HTMLElement;
  let canvas: HTMLCanvasElement;

  const sketch = (p: p5) => {
    const forward = 1;
    const gen = 100;
    const bit = 64;
    const size = 5;
    const looped = true;
    let rule = 0;
    const ca = new CA(bit, gen, looped);

    function nextRule() {
      ca.rule = BinaryToGray(++rule);
      ca.filler = Math.floor(Math.random() * Math.pow(2, bit));
      p.background(100);
      p.loop();
    }

    p.setup = function () {
      const canvas = looped
        ? p.createCanvas(size * bit, size * gen * forward)
        : p.createCanvas(size * (bit + 2 * gen), size * gen * forward);
      canvas.mouseClicked(nextRule);
      p.background(100);
      ca.rule = BinaryToGray(rule);
      ca.filler = Math.floor(Math.random() * Math.pow(2, bit));
    };

    p.draw = function () {
      ca.display(p, forward);
      if (ca.generation < ca.h * forward) {
        ca.generate();
      } else {
        p.noLoop();
        nextRule();
      }
    };
  };

  let instance: p5Extension;
  return {
    start: (node: HTMLElement) => {
      parent = node;
      instance = new p5(sketch, node) as p5Extension;
      canvas ??= instance.canvas;
      parent.style.display = "flex";
      parent.style.justifyContent = "center";
      parent.style.alignItems = "center";
    },
    stop: () => {
      instance?.remove();
      canvas?.remove();
      // parent = canvas = instance = null;
    },
  };
}
