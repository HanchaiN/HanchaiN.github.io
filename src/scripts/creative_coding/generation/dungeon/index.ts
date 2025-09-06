import {
  getPaletteAccentColor,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";
import { startAnimationLoop } from "@/scripts/utils/dom/utils.js";

import { DungeonGenerator, IPalette, drawDungeon } from "./generator.js";

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let dungeon: DungeonGenerator;
  let gen: ReturnType<typeof dungeon.generate>;
  const getPalette: () => IPalette = () => ({
    background: getPaletteBaseColor(0),
    border: getPaletteBaseColor(3 / 8),
    room: getPaletteBaseColor(1 / 8),
    path: getPaletteBaseColor(2 / 8),
    door: getPaletteBaseColor(2 / 8),
    search_path: getPaletteBaseColor(4 / 8),
    search_curr: getPaletteAccentColor(4),
    invalid: getPaletteAccentColor(0),
    node: getPaletteAccentColor(6),
    edge: getPaletteAccentColor(7),
  });
  const unit = { x: 5, y: 5 };
  let size = { x: 0, y: 0 };

  function generate_and_draw(grid_size: { x: number; y: number }) {
    dungeon = new DungeonGenerator(grid_size);
    gen = dungeon.generate();
  }

  function drawStep() {
    if (!canvas) return false;
    const { done } = gen.next();
    drawDungeon(dungeon, ctx, unit, getPalette());
    return !done;
  }
  function redraw() {
    generate_and_draw(size);
    startAnimationLoop(drawStep);
  }
  function setup() {
    if (!canvas) return;
    size = {
      x: Math.ceil(canvas.width / unit.x),
      y: Math.ceil(canvas.height / unit.y),
    };
    redraw();
  }

  return {
    start: (sketch: HTMLCanvasElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      canvas.addEventListener("click", redraw);
      setup();
    },
    stop: () => {
      canvas?.remove();
      // canvas = ctx = null;
    },
  };
}
