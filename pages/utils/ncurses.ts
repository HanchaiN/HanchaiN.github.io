import convert_color, { type RGBColor } from "./color/conversion.js";
import type { Range } from "./types.js";

export type ColorIndex = Range<256>;

type CharacterState = {
  fg: ColorIndex;
  bg: ColorIndex;
  bold: boolean;
};
type Character = {
  char: string;
  state: CharacterState;
};
function defaultCharacterState(): CharacterState {
  return {
    fg: 7,
    bg: 0,
    bold: false,
  };
}
function defaultCharacter(
  defaultState: CharacterState | null = null,
): Character {
  return {
    char: " ",
    state: defaultState ?? defaultCharacterState(),
  };
}

export interface NCursesInterface {
  get width(): number;
  get height(): number;

  setColor(fg: ColorIndex, bg: ColorIndex): void;
  setColorPair(id: number): void;
  setBold(bold: boolean): void;
  print(s: string): void;
  move(y: number, x: number): void;
  move_print(y: number, x: number, s: string): void;
}

abstract class NCursesBase implements NCursesInterface {
  protected _size: [number, number];
  protected _state: CharacterState;
  protected _loc: [number, number];

  constructor(width: number, height: number) {
    this._size = [width, height];
    this._state = defaultCharacterState();
    this._loc = [0, 0];
  }

  abstract _getCharacter(y: number, x: number): Character;
  abstract _setCharacter(y: number, x: number, char: Character): void;
  abstract _lookupColorPair(id: number): [ColorIndex, ColorIndex] | null;

  get width() {
    return this._size[0];
  }

  get height() {
    return this._size[1];
  }

  get x() {
    return this._loc[0];
  }

  get y() {
    return this._loc[1];
  }

  setColor(fg: ColorIndex, bg: ColorIndex) {
    this._state.fg = fg;
    this._state.bg = bg;
  }

  setColorPair(id: number) {
    const pair = this._lookupColorPair(id);
    if (pair) {
      this.setColor(pair[0], pair[1]);
    }
  }

  setBold(bold: boolean) {
    this._state.bold = bold;
  }

  private _rollScreen(n_rows: number = 1) {
    for (let y = 0; y < this._size[1]; y++) {
      if (n_rows < 0) y = this._size[1] - 1 - y;
      const y_ = y + n_rows;
      for (let x = 0; x < this._size[0]; x++) {
        const char =
          0 <= y_ && y_ < this._size[1]
            ? this._getCharacter(y_, x)
            : defaultCharacter(this._state);
        this._setCharacter(y, x, char);
      }
      if (n_rows < 0) y = this._size[1] - 1 - y;
    }
  }

  print(s: string, overflow_x: boolean = false, overflow_y: boolean = false) {
    for (let i = 0; i < s.length; i++) {
      this._setCharacter(this._loc[1], this._loc[0], {
        char: s[i]!,
        state: { ...this._state },
      });
      this._loc[0]++;
      if (overflow_x) continue;
      if (this._loc[0] >= this._size[0]) {
        this._loc[0] = 0;
        this._loc[1]++;
      }
      if (overflow_y) continue;
      while (this._loc[1] >= this._size[1]) {
        this._rollScreen(1);
        this._loc[1]--;
      }
    }
  }

  move(y: number, x: number) {
    this._loc[0] = x;
    this._loc[1] = y;
  }

  move_print(y: number, x: number, s: string) {
    this.move(y, x);
    this.print(s);
  }

  border(
    l: string,
    r: string,
    t: string,
    b: string,
    tl: string,
    tr: string,
    bl: string,
    br: string,
  ) {
    for (let x = 1; x < this._size[0] - 1; x++) {
      this._setCharacter(0, x, { char: t, state: { ...this._state } });
      this._setCharacter(this._size[1] - 1, x, {
        char: b,
        state: { ...this._state },
      });
    }
    for (let y = 1; y < this._size[1] - 1; y++) {
      this._setCharacter(y, 0, { char: l, state: { ...this._state } });
      this._setCharacter(y, this._size[0] - 1, {
        char: r,
        state: { ...this._state },
      });
    }
    this._setCharacter(0, 0, { char: tl, state: { ...this._state } });
    this._setCharacter(0, this._size[0] - 1, {
      char: tr,
      state: { ...this._state },
    });
    this._setCharacter(this._size[1] - 1, 0, {
      char: bl,
      state: { ...this._state },
    });
    this._setCharacter(this._size[1] - 1, this._size[0] - 1, {
      char: br,
      state: { ...this._state },
    });
  }

  clear() {
    this._loc = [0, 0];
    this._state = defaultCharacterState();
    this._rollScreen(this._size[1]);
  }
}

export class NCursesWindow extends NCursesBase {
  private _origin: [number, number];
  private _parent: NCursesBase;

  constructor(
    width: number,
    height: number,
    originY: number,
    originX: number,
    parent: NCursesBase,
  ) {
    super(width, height);
    this._origin = [originY, originX];
    this._parent = parent;
  }

  _getCharacter(y: number, x: number): Character {
    return this._parent._getCharacter(y + this._origin[0], x + this._origin[1]);
  }

  _setCharacter(y: number, x: number, char: Character): void {
    this._parent._setCharacter(y + this._origin[0], x + this._origin[1], char);
  }

  _lookupColorPair(id: number): [ColorIndex, ColorIndex] | null {
    return this._parent._lookupColorPair(id);
  }
}

export abstract class NCursesScreen extends NCursesBase {
  protected screen: Character[][];
  private _changed: Set<[number, number]>;
  private color_pairs: { [id: number]: [ColorIndex, ColorIndex] };

  constructor(width: number, height: number) {
    super(width, height);
    this.color_pairs = {};
    this._changed = new Set();
    this.screen = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => defaultCharacter(this._state)),
    );
  }

  _getCharacter(y: number, x: number): Character {
    return this.screen[y]![x]!;
  }

  _setCharacter(y: number, x: number, char: Character): void {
    this.screen[y]![x]! = char;
    this._changed.add([y, x]);
  }

  _lookupColorPair(id: number): [ColorIndex, ColorIndex] | null {
    return this.color_pairs[id] ?? null;
  }

  initPair(id: number, fg: ColorIndex, bg: ColorIndex) {
    this.color_pairs[id] = [fg, bg];
  }

  createWindow(
    height: number,
    width: number,
    originY: number,
    originX: number,
  ): NCursesWindow {
    return new NCursesWindow(width, height, originY, originX, this);
  }

  abstract _drawClear(): void;
  abstract _redrawCell(y: number, x: number): void;

  redraw(lazy: boolean = true) {
    if (lazy) {
      for (const [y, x] of this._changed) this._redrawCell(y, x);
      this._changed.clear();
      return;
    }
    this._drawClear();
    for (let y = 0; y < this._size[1]; y++) {
      for (let x = 0; x < this._size[0]; x++) {
        this._redrawCell(y, x);
      }
    }
  }
}

function colorLookup(
  code: ColorIndex,
  palette: { [code in ColorIndex]?: RGBColor } = {},
): RGBColor {
  if (code in palette) return palette[code as keyof typeof palette]!;
  if (code < 16) {
    const l1 = code === 0b1111 ? 0xff : code & 0b1000 ? 0xf3 : 0xc4;
    const l0 = code === 0b1111 ? 0x00 : code & 0b1000 ? 0x4e : 0x00;
    const r =
      code === 0b1001 ? 0xdc : code === 0b0001 ? 0xc4 : code & 0b001 ? l1 : l0;
    const g =
      code === 0b1010 ? 0xdc : code === 0b0110 ? 0x7e : code & 0b010 ? l1 : l0;
    const b =
      code === 0b1100 ? 0xdc : code === 0b0100 ? 0xc4 : code & 0b100 ? l1 : l0;
    return [r, g, b];
  }
  if (code < 232) {
    const code_ = code - 16;
    const b = Math.floor(code_ / Math.pow(6, 0)) % 6;
    const g = Math.floor(code_ / Math.pow(6, 1)) % 6;
    const r = Math.floor(code_ / Math.pow(6, 2)) % 6;
    const lookup = (c: number) => (c === 0 ? 0x00 : c * 0x28 + 0x37);
    return [lookup(r), lookup(g), lookup(b)];
  }
  if (code < 256) {
    const l = (code - 232) * 0x0a + 0x08;
    return [l, l, l];
  }
  throw new Error("Out-of-range");
}

export class Canvas2DNCursesScreen extends NCursesScreen {
  static rgb2str = convert_color("rgb", "hex")!;

  private _ctx: CanvasRenderingContext2D;
  private _palette: { [code in ColorIndex]?: RGBColor };
  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    super(width, height);
    this._ctx = ctx;
    this._palette = {};
  }

  updateColorPalette(palette: { [code in ColorIndex]?: RGBColor }) {
    this._palette = { ...this._palette, ...palette };
  }

  private _colorLookup(code: ColorIndex): string {
    this._palette[code] = colorLookup(code, this._palette);
    return Canvas2DNCursesScreen.rgb2str(this._palette[code]);
  }

  override _drawClear(): void {
    this._ctx.clearRect(0, 0, this._ctx.canvas.width, this._ctx.canvas.height);
  }

  override _redrawCell(y: number, x: number) {
    const cellWidth = this._ctx.canvas.width / this._size[0];
    const cellHeight = this._ctx.canvas.height / this._size[1];
    const fontSize = Math.min(cellWidth / 0.5, cellHeight);
    const char = this.screen[y]![x]!;
    this._ctx.fillStyle = this._colorLookup(char.state.bg)!;
    this._ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    this._ctx.font = char.state.bold
      ? `bold ${fontSize}px monospace`
      : `${fontSize}px monospace`;
    this._ctx.textAlign = "center";
    this._ctx.textBaseline = "middle";
    this._ctx.fillStyle = this._colorLookup(char.state.fg)!;
    this._ctx.fillText(
      char.char,
      x * cellWidth + cellWidth / 2,
      y * cellHeight + cellHeight / 2,
    );
    this._ctx.fillText(
      char.char,
      x * cellWidth + cellWidth / 2,
      y * cellHeight + cellHeight / 2,
    );
  }
}
