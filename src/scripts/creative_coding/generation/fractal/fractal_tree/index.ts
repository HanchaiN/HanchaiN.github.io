import { Vector } from "@/scripts/utils/math/vector.js";
import { constrain } from "@/scripts/utils/math/utils.js";
import p5 from "p5";
import { Branch } from "./branch.js";
import type { p5Extension } from "@/scripts/utils/types.ts";
import { PHI } from "@/scripts/utils/math/constants.js";
import { PerlinNoise as Noise } from "@/scripts/utils/math/noise.js";
export default function execute() {
  let wrapper: HTMLElement;
  let canvas: HTMLCanvasElement;
  let alpha: HTMLInputElement,
    beta1: HTMLInputElement,
    beta2: HTMLInputElement,
    resetButton: HTMLButtonElement;
  const NAIVE = Symbol("NAIVE"),
    MATURE = Symbol("MATURE");

  const sketch = (p: p5) => {
    let root: Branch;
    let wind: Noise;
    let leaves: [Vector, Vector][] = [];

    const widScale = 1 / PHI;
    const lenScale = 0.8;
    const LEAVES_COUNT = 100;
    const LEAVES_COUNT_MAX = 1000;
    const getLeavesCount = () =>
      Math.min(LEAVES_COUNT * root.childCount, LEAVES_COUNT_MAX);

    let tree_layer: p5.Graphics;
    let isLeaves = false;

    p.setup = function () {
      p.createCanvas(500, 500);
      tree_layer = p.createGraphics(p.width, p.height);
      wind = new Noise();
      resetButton.addEventListener("click", () => {
        isLeaves = !isLeaves;
        leaves = [];
      });
      reset();
      alpha.addEventListener("input", reset);
      beta1.addEventListener("input", reset);
      beta2.addEventListener("input", reset);
    };

    p.draw = function () {
      p.clear(0, 0, 0, 0);
      p.image(tree_layer, 0, 0);
      if (isLeaves) {
        addLeaves(root);
        pruneLeaves();
        updateLeaves();
        p.noStroke();
        p.translate(p.width / 2, p.height / 2);
        leaves.forEach(([pos], i) => {
          p.fill(255, 0, 100, constrain(i / leaves.length, 0.1, 1) * 128);
          p.ellipse(pos.x, pos.y, 2, 2);
        });
      }
    };

    function reset() {
      leaves = [];
      const init_len = 250 / (lenScale / (1 - lenScale));
      const a = new Vector(0, init_len);
      const b = new Vector(0, 0);
      root = new Branch(a, b, NAIVE, {
        [NAIVE]: [
          {
            angle: alpha.valueAsNumber * Math.PI,
            widScale: Math.pow(widScale, 0),
            lenScale,
            type: MATURE,
          },
        ],
        [MATURE]: [
          {
            angle: beta1.valueAsNumber * Math.PI,
            widScale: Math.pow(widScale, 2),
            lenScale,
            type: NAIVE,
          },
          {
            angle: beta2.valueAsNumber * Math.PI,
            widScale: Math.pow(widScale, 1),
            lenScale,
            type: MATURE,
          },
        ],
      });
      for (let i = 0; i < 15; i++) {
        root.grow();
      }
      redrawTree();
    }
    function redrawTree() {
      tree_layer.clear(0, 0, 0, 0);
      tree_layer.push();
      tree_layer.translate(tree_layer.width / 2, tree_layer.height / 2);
      root.show(tree_layer, 10);
      tree_layer.pop();
    }
    function addLeaves(root: Branch) {
      let count = 0;
      for (const branch of root.branches.sort(() => Math.random() - 0.5)) {
        count += addLeaves(branch);
        if (count > LEAVES_COUNT) return count;
      }
      if (Math.random() > leaves.length / getLeavesCount()) {
        leaves.push([root.end.copy(), new Vector(0, 0)]);
        count++;
      }
      return count;
    }
    function pruneLeaves() {
      const oldCount = leaves.length;
      leaves = leaves.filter(
        ([pos]) =>
          pos.y < 300 && Math.random() > leaves.length / getLeavesCount() - 1.0,
      );
      return oldCount - leaves.length;
    }
    function updateLeaves() {
      leaves.forEach(([pos, vel]) => {
        pos.add(vel);
        vel.add(new Vector(0, 0.1));
        vel.add(new Vector(1, 0).mult(wind.noise(pos.x, pos.y, 0)));
        vel.add(new Vector(0, 1).mult(wind.noise(pos.x, pos.y, 10)));
        vel.mult(0.99);
      });
    }
  };

  let instance: p5Extension;
  return {
    start: (node: HTMLDivElement, config: HTMLFormElement) => {
      wrapper = node;
      alpha = config.querySelector("#alpha")!;
      beta1 = config.querySelector("#beta1")!;
      beta2 = config.querySelector("#beta2")!;
      resetButton = config.querySelector("#reset")!;
      instance = new p5(sketch, wrapper) as p5Extension;
      canvas ??= instance.canvas;
    },
    stop: () => {
      instance?.remove();
      canvas?.remove();
    },
  };
}
