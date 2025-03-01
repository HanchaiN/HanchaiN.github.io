import { getParentSize } from "@/scripts/utils/dom/utils.js";
import { Complex } from "@/scripts/utils/math/complex.js";
import type { p5Extension } from "@/scripts/utils/types.ts";
import p5 from "p5";
import { Draggable } from "./draggable.js";
import { Gyrovector } from "./gyrovector.js";
import {
  getPaletteAccentColor,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";
export default function execute() {
  let parent: HTMLElement;
  let canvas: HTMLCanvasElement;
  let resizeObserver: ResizeObserver;

  const sketch = (p: p5) => {
    let r: number, Ox: number, Oy: number;
    const A = new Draggable(10);
    const B = new Draggable(10);

    Draggable.p = p;

    function setOffset() {
      Ox = p.width / 2;
      Oy = p.height / 2;
      r = Math.min(Ox, Oy);
      A.setOffset(Ox, Oy, r);
      B.setOffset(Ox, Oy, r);
    }
    function canvasposition(x: number, y: number): [number, number] {
      return [x * r + Ox, -y * r + Oy];
    }
    function calculateposition(x: number, y: number): [number, number] {
      return [(x - Ox) / r, (-y + Oy) / r];
    }
    function parentResized() {
      const { width, height } = getParentSize(parent, canvas);
      p.resizeCanvas(width, height);
      setOffset();
    }
    p.setup = function () {
      const { width, height } = getParentSize(parent, canvas);
      p.createCanvas(width, height);
      setOffset();
      A.setPosition(...canvasposition(0, 0.975));
      B.setPosition(...canvasposition(0.1, -0.99));
      resizeObserver = new ResizeObserver(parentResized);
      resizeObserver.observe(parent);
    };
    p.draw = function () {
      p.clear(0, 0, 0, 0);
      p.strokeWeight(1);
      p.stroke(getPaletteBaseColor(1));
      p.fill(getPaletteBaseColor(0));
      p.circle(Ox, Oy, 2 * r);
      p.strokeWeight(5);
      p.stroke(getPaletteBaseColor(1));
      p.point(Ox, Oy);

      A.hover();
      A.update();
      B.hover();
      B.update();
      operate();
      A.show();
      B.show();
    };

    function operate() {
      p.push();
      const a = new Gyrovector(
        Complex.fromCartesian(...calculateposition(A.x, A.y)),
      );
      const b = new Gyrovector(
        Complex.fromCartesian(...calculateposition(B.x, B.y)),
      );
      p.strokeWeight(2.5);
      p.stroke(getPaletteAccentColor(0));
      p.line(Ox, Oy, A.x, A.y);
      p.stroke(getPaletteAccentColor(3));
      p.line(Ox, Oy, B.x, B.y);
      {
        p.strokeWeight(3.75);
        p.stroke(getPaletteAccentColor(6));
        p.noFill();
        const l = Gyrovector.geodesic(a, a.add(b));
        switch (l[0]) {
          case "circle":
            p.circle(...canvasposition(l[1], l[2]), 2 * r * l[3]);
            break;
        }
      }
      {
        const sum = a.add(b);
        const pos = canvasposition(sum.z.re, sum.z.im);
        p.strokeWeight(7.5);
        p.stroke(getPaletteAccentColor(6));
        p.point(pos[0], pos[1]);
      }
      {
        p.strokeWeight(3.75);
        p.stroke(getPaletteBaseColor(1));
        p.noFill();
        const l = Gyrovector.geodesic(a, b);
        switch (l[0]) {
          case "circle":
            p.circle(...canvasposition(l[1], l[2]), 2 * r * l[3]);
            break;
        }
      }
      p.pop();
    }

    p.mousePressed = function () {
      A.pressed();
      B.pressed();
    };
    p.mouseReleased = function () {
      A.released();
      B.released();
    };
  };

  let instance: p5Extension;
  return {
    start: (node: HTMLElement) => {
      parent = node;
      instance = new p5(sketch, node) as p5Extension;
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
