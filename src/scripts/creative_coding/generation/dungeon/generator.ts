import { PriorityQueue } from "@/scripts/utils/algo/datastructure.js";
import { delaunay_triangulation_step } from "@/scripts/utils/algo/delaunay_triangulation.js";
import { minimum_spanning_tree_step } from "@/scripts/utils/algo/minimum_spanning_tree.js";
import { PerlinNoise } from "@/scripts/utils/math/noise.js";
import { randomGaussian } from "@/scripts/utils/math/random.js";
import { constrain, map } from "@/scripts/utils/math/utils.js";
import { Vector } from "@/scripts/utils/math/vector.js";

function* shortest_path<T>(
  nodes: T[],
  i_begin: number,
  i_target: number,
  isEqual: (a: T, b: T) => boolean,
  getCost: (a: T) => number,
  estimateCost: (a: T, b: T) => number,
  getNeighbors: (a: T) => number[],
  addPath: (a: T, isFinal: boolean) => void,
  addSearched: (a: T) => void,
  clearTemp: () => void,
) {
  const state: {
    parent: number | null;
    distance: number;
  }[] = new Array(nodes.length).fill(null).map(() => ({
    parent: null,
    distance: Infinity,
  }));
  const lookup = new PriorityQueue<{
    p: number;
    distance: number;
    est_distance: number;
  }>((_) => _.est_distance);
  const addNode = (p: number, parent: number | null, dist: number) => {
    if (p < 0 || p >= nodes.length) return;
    for (let p_ = parent; p_ !== null; p_ = state[p_].parent) {
      if (isEqual(nodes[p], nodes[p_])) return;
    }
    const cost = getCost(nodes[p]);
    const distance = dist + cost;
    if (state[p].distance <= distance) return;
    const est = estimateCost(nodes[p], nodes[i_target]);
    const est_distance = distance + est;
    state[p].distance = distance;
    state[p].parent = parent;
    lookup.push({
      p,
      distance,
      est_distance,
    });
  };
  const tracePath = function* (p: number) {
    let p_: number | null = p;
    do {
      yield p_;
    } while ((p_ = state[p_].parent) != null);
  };
  addNode(i_begin, null, 0);
  let i_curr: number | null = null;
  while (lookup.top()) {
    const { p, distance } = lookup.pop()!;
    if (state[p].distance < distance) continue;
    if (isEqual(nodes[i_target], nodes[p])) {
      i_curr = p;
      break;
    }
    getNeighbors(nodes[p])
      .filter((p_) => 0 <= p_ && p_ < nodes.length)
      .sort(() => 0.5 - Math.random())
      .forEach((p_) => {
        addNode(p_, p, distance);
      });
    for (const i of tracePath(p)) addPath(nodes[i], false);
    addSearched(nodes[p]);
    yield;
    clearTemp();
  }
  console.log("NFOUND");
  if (i_curr === null) return false;
  for (const i of tracePath(i_curr!)) addPath(nodes[i], true);
  return true;
}
export enum GRID_STATE {
  EMPTY = 1,
  ROOM = 2,
  BORDER = 3,
  PATH = 4,
  INTERNAL_PATH = 5,
  DOOR = 6,
  SEARCH_PATH = 7,
  SEARCH_CURR = 8,
  SEARCHED = 9,
}

export interface IPalette {
  background: string;
  border: string;
  room: string;
  path: string;
  door: string;
  search_path: string;
  search_curr: string;
  invalid: string;
  node: string;
  edge: string;
}
export function drawDungeon(
  data: {
    grid: number[][];
    rooms: {
      left: number;
      right: number;
      bottom: number;
      top: number;
      valid: boolean;
    }[];
    nodes: { x: number; y: number }[];
    edges: number[][];
    tree: number[];
  },
  ctx: CanvasRenderingContext2D,
  unit: { x: number; y: number },
  palette: IPalette,
) {
  ctx.lineWidth = 0;
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!data) return;
  data.grid?.forEach((_, ix) =>
    _.forEach((v, iy) => {
      switch (v) {
        case GRID_STATE.SEARCH_CURR:
          ctx.fillStyle = palette.search_curr;
          break;
        case GRID_STATE.SEARCHED:
          ctx.fillStyle = palette.search_path;
          break;
        case GRID_STATE.SEARCH_PATH:
        case GRID_STATE.PATH:
          ctx.fillStyle = palette.path;
          break;
        case GRID_STATE.DOOR:
          ctx.fillStyle = palette.door;
          break;
        case GRID_STATE.BORDER:
        case GRID_STATE.INTERNAL_PATH:
        case GRID_STATE.ROOM:
          ctx.fillStyle = palette.room;
          break;
        case GRID_STATE.EMPTY:
          ctx.fillStyle = palette.background;
          break;
        default:
          return;
      }
      ctx.beginPath();
      ctx.rect(unit.x * ix, unit.y * iy, unit.x, unit.y);
      ctx.fill();
    }),
  );
  data.rooms?.forEach((room) => {
    ctx.lineWidth = 1;
    ctx.strokeStyle = room.valid ? palette.border : palette.invalid;
    ctx.strokeRect(
      unit.x * room.left,
      unit.y * room.bottom,
      unit.x * (room.right - room.left + 1),
      unit.y * (room.top - room.bottom + 1),
    );
  });
  if (!data.nodes) return;
  data.nodes.forEach((p) => {
    ctx.fillStyle = palette.node;
    ctx.beginPath();
    ctx.arc(unit.x * p.x, unit.y * p.y, 1, 0, Math.PI * 2);
    ctx.fill();
  });
  if (!data.edges) return;
  data.edges?.forEach(([ia, ib], i) => {
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = data.tree?.includes?.(i) ? 1.5 : 1;
    const a = data.nodes[ia],
      b = data.nodes[ib];
    ctx.beginPath();
    ctx.moveTo(unit.x * a.x, unit.y * a.y);
    ctx.lineTo(unit.x * b.x, unit.y * b.y);
    ctx.stroke();
  });
}

export class DungeonGenerator {
  GRID_SIZE: { x: number; y: number };
  rooms!: {
    left: number;
    right: number;
    bottom: number;
    top: number;
    valid: boolean;
  }[];
  _room_area!: number;
  nodes!: Vector[];
  edges!: number[][];
  tree!: number[];
  grid!: GRID_STATE[][];
  _noise!: PerlinNoise;
  constructor(GRID_SIZE: { x: number; y: number }) {
    this.GRID_SIZE = { x: GRID_SIZE.x, y: GRID_SIZE.y };
    this.clear();
  }
  clear() {
    this.rooms = [];
    this._room_area = 0;
    this.nodes = [];
    this.edges = [];
    this.tree = [];
    this.grid = new Array(this.GRID_SIZE.x)
      .fill(null)
      .map(() =>
        new Array(this.GRID_SIZE.y).fill(null).map(() => GRID_STATE.EMPTY),
      );
    this._noise = new PerlinNoise();
  }
  addRoom(
    ROOM_SIZE_MIN = 5,
    ROOM_SIZE_MAX = 0.25 * Math.min(this.GRID_SIZE.x, this.GRID_SIZE.y),
    ROOM_AREA_TOTAL = 0.5 * this.GRID_SIZE.x * this.GRID_SIZE.y,
    ROOM_PADDING = 3,
  ) {
    const aspect = Math.abs(randomGaussian(1, 0.5 / 3));
    const width =
      ROOM_SIZE_MIN * Math.max(1, 1 / aspect) +
      Math.abs(randomGaussian(0, ROOM_SIZE_MAX / 3));
    const height = width * aspect;
    const node = new Vector(
      map(
        Math.random(),
        0,
        1,
        ROOM_PADDING + width / 2,
        this.GRID_SIZE.x - ROOM_PADDING - width / 2,
      ),
      map(
        Math.random(),
        0,
        1,
        ROOM_PADDING + height / 2,
        this.GRID_SIZE.y - ROOM_PADDING - height / 2,
      ),
    );
    const room = {
      left: Math.round(node.x - width / 2),
      right: Math.round(node.x + width / 2),
      bottom: Math.round(node.y - height / 2),
      top: Math.round(node.y + height / 2),
      valid: this._room_area < ROOM_AREA_TOTAL,
    };
    room.valid &&= this.rooms.every(
      (room_) =>
        room.left > room_.right + ROOM_PADDING ||
        room.right + ROOM_PADDING < room_.left ||
        room.bottom > room_.top + ROOM_PADDING ||
        room.top + ROOM_PADDING < room_.bottom,
    );
    this.rooms.push(room);
    if (!room.valid) return false;
    this.nodes.push(node);
    this._room_area +=
      (room.right - room.left + 1) * (room.top - room.bottom + 1);
    for (let ix = room.left; ix <= room.right; ix++)
      for (let iy = room.bottom; iy <= room.top; iy++)
        this.grid[ix][iy] =
          ix === room.left ||
          ix === room.right ||
          iy === room.bottom ||
          iy === room.top
            ? GRID_STATE.BORDER
            : GRID_STATE.ROOM;
    return true;
  }
  *genEdges_Stepwise() {
    const edges_gen = delaunay_triangulation_step(this.nodes, [
      new Vector(0, 0),
      new Vector(2 * this.GRID_SIZE.x, 0),
      new Vector(0, 2 * this.GRID_SIZE.y),
    ]);
    while (true) {
      const { value, done } = edges_gen.next();
      yield (this.edges = value);
      if (done) break;
    }
    return this.edges;
  }
  genEdges() {
    for (const _ of this.genEdges_Stepwise()) {
      _; // eslint-disable-line @typescript-eslint/no-unused-expressions
    }
  }
  *genTree_Stepwise() {
    const tree_gen = minimum_spanning_tree_step(
      this.edges.map(([ia, ib]) => [
        ia,
        ib,
        Vector.sub(this.nodes[ia], this.nodes[ib]).magSq(),
      ]),
    );
    while (true) {
      const { value, done } = tree_gen.next();
      this.tree = value;
      yield;
      if (done) break;
    }
    return this.tree;
  }
  genTree() {
    for (const _ of this.genTree_Stepwise()) {
      _; // eslint-disable-line @typescript-eslint/no-unused-expressions
    }
  }
  filterEdges(EXTRA_NODE_RATE = 0.125) {
    this.edges.sort((a, b) => {
      let ia = this.tree.indexOf(this.edges.indexOf(a)),
        ib = this.tree.indexOf(this.edges.indexOf(b));
      if (ia < 0) ia = Infinity;
      if (ib < 0) ib = Infinity;
      return ia - ib;
    });
    this.tree = this.tree.map((_, i) => i);
    this.edges = this.edges.filter((_, i) => {
      return this.tree.includes(i) ? true : Math.random() < EXTRA_NODE_RATE;
    });
  }
  _getCost(x: number, y: number) {
    const DIST_VAL = new Proxy<{ [key in GRID_STATE]?: number }>(
      {
        [GRID_STATE.EMPTY]: 10,
        [GRID_STATE.ROOM]: 1,
        [GRID_STATE.BORDER]: 5,
        [GRID_STATE.PATH]: 2,
        [GRID_STATE.INTERNAL_PATH]: 1,
        [GRID_STATE.DOOR]: 1,
      },
      {
        get: (target, name) =>
          target[name as unknown as GRID_STATE] ?? Infinity,
      },
    ) as { [key in GRID_STATE]: number };
    const DIST_VAR = new Proxy<{ [key in GRID_STATE]?: number }>(
      {
        [GRID_STATE.EMPTY]: 3,
      },
      {
        get: (target, name) => target[name as unknown as GRID_STATE] ?? 0,
      },
    ) as { [key in GRID_STATE]: number };
    return constrain(
      DIST_VAL[this.grid[Math.round(x)][Math.round(y)]] +
        this._noise.noise(x * 0.5, y * 0.5, 0) *
          3 *
          DIST_VAR[this.grid[Math.round(x)][Math.round(y)]],
      0,
      Infinity,
    );
  }
  _estimateCost(from: { x: number; y: number }, to: { x: number; y: number }) {
    let dist = 0;
    const steep = Math.abs(to.y - from.y) > Math.abs(to.x - from.x);
    const fpart = (x: number) => x - Math.floor(x);
    const rfpart = (x: number) => 1 - fpart(x);
    const putVal = (x: number, y: number, w: number) => {
      const [x_, y_] = steep ? [y, x] : [x, y];
      if (x_ >= this.grid.length || y_ >= this.grid[x_].length) return;
      dist += w * this._getCost(x_, y_);
    };
    let x0 = from.x,
      y0 = from.y,
      x1 = to.x,
      y1 = to.y,
      dx = x1 - x0,
      dy = y1 - y0;
    if (steep) [x0, y0, x1, y1, dx, dy] = [y0, x0, y1, x1, dy, dx];
    if (x1 < x0) [x0, x1, y0, y1] = [x1, x0, y1, y0];
    const grad = dx === 0 ? 1 : dy / dx;
    let intery = y0 + rfpart(x0) * grad;
    const endpoint = (x: number, y: number) => {
      const xend = Math.round(x);
      const yend = y + grad * (xend - x);
      const xgap = rfpart(x + 0.5);
      const px = Math.floor(xend),
        py = Math.floor(yend);
      putVal(px, py, rfpart(yend) * xgap);
      putVal(px, py + 1, fpart(yend) * xgap);
      return px;
    };
    const xstart = endpoint(x0, y0) + 1;
    const xend = endpoint(x1, y1);
    for (let x = xstart; x < xend; x++) {
      const y = Math.floor(intery);
      putVal(x, y, rfpart(intery));
      putVal(x, y + 1, fpart(intery));
      intery += grad;
    }
    return dist;
  }
  *generate() {
    const ROOM_COUNT_MAX = 100;
    const ROOM_AREA_TOTAL = 0.5 * this.GRID_SIZE.x * this.GRID_SIZE.y;
    this.clear();
    yield;
    const room_area = 0;
    for (let i = 0; i < ROOM_COUNT_MAX && room_area < ROOM_AREA_TOTAL; i++) {
      this.addRoom();
      yield;
      this.rooms = this.rooms.filter((room) => room.valid);
    }
    yield* this.genEdges_Stepwise();
    yield* this.genTree_Stepwise();
    yield this.filterEdges();
    for (const [i_begin, i_target] of this.edges) {
      const nodes = this.grid
        .map((_, i) => _.map((_, j) => new Vector(i, j)))
        .flat();
      let grid_ = this.grid.map((_) => _.map((_) => _));
      const _grid = this.grid.map((_) => _.map((_) => _));
      const gen = shortest_path(
        nodes,
        nodes.findIndex(
          (v) =>
            v.x === Math.round(this.nodes[i_begin].x) &&
            v.y === Math.round(this.nodes[i_begin].y),
        ),
        nodes.findIndex(
          (v) =>
            v.x === Math.round(this.nodes[i_target].x) &&
            v.y === Math.round(this.nodes[i_target].y),
        ),
        (a, b) => a.x === b.x && a.y === b.y,
        (a) => this._getCost(a.x, a.y),
        (a, b) => this._estimateCost(a, b),
        (a) => [
          nodes.findIndex(
            (v) => v.x === Math.round(a.x + 1) && v.y === Math.round(a.y),
          ),
          nodes.findIndex(
            (v) => v.x === Math.round(a.x - 1) && v.y === Math.round(a.y),
          ),
          nodes.findIndex(
            (v) => v.x === Math.round(a.x) && v.y === Math.round(a.y + 1),
          ),
          nodes.findIndex(
            (v) => v.x === Math.round(a.x) && v.y === Math.round(a.y - 1),
          ),
        ],
        (a, isFinal) =>
          (grid_[Math.round(a.x)][Math.round(a.y)] = isFinal
            ? GRID_STATE.PATH
            : GRID_STATE.SEARCH_PATH),
        (a) =>
          (grid_[Math.round(a.x)][Math.round(a.y)] = GRID_STATE.SEARCH_CURR),
        () =>
          (grid_ = grid_.map((_) =>
            _.map((_) =>
              _ === GRID_STATE.SEARCH_PATH || _ === GRID_STATE.SEARCH_CURR
                ? GRID_STATE.SEARCHED
                : _,
            ),
          )),
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ of gen) {
        this.grid = grid_;
        yield;
        this.grid = _grid;
      }
      this.grid = this.grid.map((_, i) =>
        _.map((_, j) => {
          switch (grid_[i][j]) {
            case GRID_STATE.PATH:
              switch (_grid[i][j]) {
                case GRID_STATE.EMPTY:
                  return GRID_STATE.PATH;
                case GRID_STATE.ROOM:
                  return GRID_STATE.INTERNAL_PATH;
                case GRID_STATE.BORDER:
                  return GRID_STATE.DOOR;
                default:
                  return _grid[i][j];
              }
            default:
              return _grid[i][j];
          }
        }),
      );
      grid_ = this.grid.map((_) => _.map((_) => _));
    }
    return;
  }
}
