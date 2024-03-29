import { getParentSize } from "@/script/utils/dom";
import { constrain, Vector } from "@/script/utils/math";
import p5 from "p5";
import { Branch } from "./branch";
import type { p5Extension } from "@/script/utils/types";
export default function execute() {
  let parent: HTMLElement, wrapper: HTMLElement;
  let canvas: HTMLCanvasElement;
  let resizeObserver: ResizeObserver;
  let alpha: HTMLInputElement,
    beta1: HTMLInputElement,
    beta2: HTMLInputElement,
    resetButton: HTMLButtonElement;

  const sketch = (p: p5) => {
    let tree: Branch[] = [];
    let leaves: Vector[] = [];
    let branch: number[][] = [];

    const strokemultillier = 0.5;
    const LEAVES_COUNT = 100;

    // let alpha, beta1, beta2, resetButton;
    let tree_layer: p5.Graphics;

    function parentResized() {
      const { width, height } = getParentSize(wrapper, canvas);
      p.resizeCanvas(width, height);
      tree_layer = p.createGraphics(p.width, p.height);
      updateTreeLayer();
    }
    p.setup = function () {
      const { width, height } = getParentSize(wrapper, canvas);
      const c = p.createCanvas(width, height);
      tree_layer = p.createGraphics(p.width, p.height);
      c.mouseClicked(grow);
      reset();
      resetButton.addEventListener("click", reset);
      resizeObserver = new ResizeObserver(parentResized);
      resizeObserver.observe(wrapper);
    };

    p.draw = function () {
      p.clear(0, 0, 0, 0);
      p.image(tree_layer, 0, 0);
      updateLeaves();
      const count = addLeaves();
      p.noStroke();
      p.translate(p.width / 2, p.height / 2);
      for (let i = 0; i < leaves.length; i++) {
        p.fill(255, 0, 100, constrain((128 * count) / leaves.length, 1, 128));
        p.ellipse(leaves[i].x, leaves[i].y, 8, 8);
      }
    };

    function reset() {
      tree = [];
      leaves = [];
      branch = [];
      const a = new Vector(0, 0);
      const b = new Vector(0, -100);
      const root = new Branch(a, b, 0, [
        [[Number.parseFloat(alpha.value) * Math.PI, 0.67, 1]],
        [
          [Number.parseFloat(beta1.value) * Math.PI, 0.67, 0],
          [Number.parseFloat(beta2.value) * Math.PI, 0.67, 1],
        ],
      ]);

      tree[0] = root;
      branch = [[]];
      updateTreeLayer();
    }

    function grow() {
      for (let i = tree.length - 1; i >= 0; i--) {
        if (!tree[i].finished) {
          const branches = tree[i].branch();
          for (let j = 0; j < branches.length; j++) {
            tree.push(branches[j]);
            branch[i].push(tree.length - 1);
            branch.push([]);
          }
        }
        let sum = 0;
        for (let j = 0; j < branch[i].length; j++) {
          sum += tree[branch[i][j]].size;
        }
        tree[i].size = sum * strokemultillier;
        tree[i].finished = true;
      }
      updateTreeLayer();
    }
    function updateTreeLayer() {
      tree_layer.clear(0, 0, 0, 0);
      tree_layer.push();
      tree_layer.translate(tree_layer.width / 2, tree_layer.height / 2);
      for (let i = 0; i < tree.length; i++) {
        tree[i].show(tree_layer);
      }
      tree_layer.pop();
    }
    function addLeaves() {
      let count = 0;
      const leaves_count = leaves.length;
      for (let i = 0; i < tree.length; i++) {
        if (!tree[i].finished) {
          if (Math.random() > leaves_count / LEAVES_COUNT)
            leaves.push(tree[i].end.copy());
          count++;
        }
      }
      return count;
    }
    function updateLeaves() {
      leaves.forEach((leaf) => {
        leaf.add(Vector.random2D());
      });
      leaves = leaves.filter(
        () => Math.random() > leaves.length / LEAVES_COUNT,
      );
    }
  };

  let instance: p5Extension;
  return {
    start: (node: HTMLElement) => {
      parent = node;
      alpha = parent.appendChild(document.createElement("input"));
      beta1 = parent.appendChild(document.createElement("input"));
      beta2 = parent.appendChild(document.createElement("input"));
      resetButton = parent.appendChild(document.createElement("button"));
      wrapper = parent.appendChild(document.createElement("div"));
      alpha.type = beta1.type = beta2.type = "range";
      alpha.min = beta1.min = beta2.min = "-1";
      alpha.max = beta1.max = beta2.max = "1";
      alpha.step = beta1.step = beta2.step = "1e-18";
      alpha.value = beta1.value = beta2.value = "0";
      resetButton.innerText = "reset";
      instance = new p5(sketch, wrapper) as p5Extension;
      canvas ??= instance.canvas;
    },
    stop: () => {
      parent.removeChild(alpha);
      parent.removeChild(beta1);
      parent.removeChild(beta2);
      parent.removeChild(resetButton);
      instance?.remove();
      canvas?.remove();
      resizeObserver?.disconnect();
      // wrapper = canvas = instance = resizeObserver = null;
    },
  };
}
