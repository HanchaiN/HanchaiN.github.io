import { getParentSize } from "@/scripts/utils/dom/utils.js";
import type { p5Extension } from "@/scripts/utils/types.ts";
import {
  getPaletteAccentColor,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";
import p5 from "p5";
import type { Rule } from "./turing.js";
import { TuringMachine } from "./turing.js";
export default function execute() {
  let parent: HTMLElement;
  let canvas: HTMLCanvasElement;
  let resizeObserver: ResizeObserver;

  const sketch = (p: p5) => {
    // Display
    const min_resolution = 10,
      max_resolution = 20; //px
    const _fr = 0; //fps
    const _viewrange = 50; //blocks
    let resolution = (min_resolution + max_resolution) / 2,
      viewrange = _viewrange;

    // Wolfram's (2,3) Turing machine
    const states = [getPaletteBaseColor(6 / 8), getPaletteBaseColor(8 / 8)];
    const entries = [
      getPaletteAccentColor(0),
      getPaletteAccentColor(3),
      getPaletteAccentColor(6),
    ];
    type State = (typeof states)[number];
    type Entry = (typeof entries)[number];
    const notation: Rule<State, Entry> = {
      states,
      entries,
      null_symbol: entries[0],
      operation_table: new Map([
        [
          states[0],
          new Map<
            Entry,
            {
              state: State;
              symbol: Entry;
              direction: "R" | "L" | "N";
            }
          >([
            [
              entries[0],
              {
                state: states[1],
                symbol: entries[1],
                direction: "L",
              },
            ],
            [
              entries[1],
              {
                state: states[0],
                symbol: entries[2],
                direction: "R",
              },
            ],
            [
              entries[2],
              {
                state: states[0],
                symbol: entries[1],
                direction: "R",
              },
            ],
          ]),
        ],
        [
          states[1],
          new Map<
            Entry,
            {
              state: State;
              symbol: Entry;
              direction: "R" | "L" | "N";
            }
          >([
            [
              entries[0],
              {
                state: states[0],
                symbol: entries[2],
                direction: "R",
              },
            ],
            [
              entries[1],
              {
                state: states[1],
                symbol: entries[2],
                direction: "L",
              },
            ],
            [
              entries[2],
              {
                state: states[0],
                symbol: entries[0],
                direction: "L",
              },
            ],
          ]),
        ],
      ]),
      initial_state: states[0],
    };

    // Declare
    const inp: Entry[] = [];
    const tm = new TuringMachine(notation);

    function parentResized() {
      const { width } = getParentSize(parent, canvas);
      viewrange = p.constrain(
        viewrange,
        Math.floor(width / min_resolution),
        Math.ceil(width / max_resolution),
      );
      resolution = width / viewrange;
      p.resizeCanvas(width, resolution * 3);
    }
    p.setup = function () {
      tm.init(inp);
      const { width } = getParentSize(parent, canvas);
      viewrange = p.constrain(
        viewrange,
        Math.floor(width / min_resolution),
        Math.ceil(width / max_resolution),
      );
      resolution = width / viewrange;
      p.createCanvas(width, resolution * 3);
      if (_fr > 0) {
        p.frameRate(_fr);
      }
      resizeObserver = new ResizeObserver(parentResized);
      resizeObserver.observe(parent);
    };

    p.draw = function () {
      p.background(getPaletteBaseColor(1 / 8));
      p.stroke(getPaletteBaseColor(3 / 8));
      p.fill(tm.state);
      p.rect(
        Math.floor(viewrange / 2) * resolution,
        resolution * 2,
        resolution,
        resolution,
      );
      for (let i = 0; i < viewrange; i++) {
        p.fill(tm.read(i + tm.pointer - Math.floor(viewrange / 2)));
        p.rect(i * resolution, resolution * 0, resolution, resolution);
      }
      if (!tm.calculate()) p.noLoop();
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
    },
  };
}
