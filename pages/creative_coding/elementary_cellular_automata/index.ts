import p5 from "p5";

import { CA } from "./ca.js";
import { BinaryToGray } from "./gray.js";

export default function execute() {
  let root_: HTMLElement;
  let canvas_: HTMLCanvasElement;

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
        ? p.createCanvas(size * bit, size * gen * forward, "p2d", canvas_)
        : p.createCanvas(
            size * (bit + 2 * gen),
            size * gen * forward,
            "p2d",
            canvas_,
          );
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

  let instance: p5;
  return {
    start: (root: HTMLElement, canvas: HTMLCanvasElement) => {
      root_ = root;
      canvas_ = canvas;
      instance = new p5(sketch, root_);
      root_.style.display = "flex";
      root_.style.justifyContent = "center";
      root_.style.alignItems = "center";
    },
    stop: () => {
      instance?.remove();
    },
  };
}
