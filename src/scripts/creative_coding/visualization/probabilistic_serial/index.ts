import convert_color from "@/scripts/utils/color/conversion.js";
import type { HCLColor } from "@/scripts/utils/color/conversion.ts";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { DragListY } from "@/scripts/utils/dom/element/DragListY.js";
import { Fraction } from "@/scripts/utils/math/fraction.js";

const hcl2str = convert_color("hcl", "hex")!;

export default function execute() {
  let isActive: boolean = false;
  const agent_hcl: HCLColor = [0, 0.7, 0.7];
  const item_hcl: HCLColor = [0, 0.7, 0.3];
  const fg_col: string = getPaletteBaseColor(1);
  let sample_bvn: number = 100; // Number of samples to estimate BvN decomposition
  const do_shift: boolean = false;
  let dragLists: DragListY[] = [];
  const preference: Map<number, number[]> = new Map();
  let baseDistribution: Map<number, { id: number; value: Fraction }[]> | null =
    null;
  let baseDecomposition: [Fraction, number[]][] | null = null;
  let distribution: Map<number, { id: number; value: Fraction }[]> | null =
    null;
  const selected: Map<number, number> = new Map();

  function refresh_list(config: HTMLFormElement) {
    const count =
      config.querySelector<HTMLInputElement>("#count")!.valueAsNumber;
    const lists = config.querySelector<HTMLDivElement>("div#lists")!;
    lists.innerHTML = "";
    const select = config.querySelector<HTMLSelectElement>("select#item")!;
    select.innerHTML = "";
    dragLists = [];
    for (let i = 0; i < count; i++) {
      const list = document.createElement("div");
      list.classList.add("col-md-auto");
      const label = document.createElement("label");
      const ol = document.createElement("ol");
      ol.id = label.htmlFor = `list-a${i}`;
      label.textContent = `Agent ${i}:`;
      label.style.color = hcl2str([i / count, agent_hcl[1], agent_hcl[2]]);
      list.appendChild(label);
      const dragList = new DragListY(
        ol,
        count,
        (id) => {
          const item = document.createElement("li");
          item.textContent = `Item ${id}`;
          item.style.color = hcl2str([
            (0.5 + id) / count,
            item_hcl[1],
            item_hcl[2],
          ]);
          return item;
        },
        i,
      );
      dragLists.push(dragList);
      list.appendChild(ol);
      lists.appendChild(list);
      const option = document.createElement("option");
      option.value = `${i}`;
      option.textContent = `Item ${i}`;
      select.appendChild(option);
    }
    initStep(config, "1");
  }

  function showSteps(config: HTMLFormElement, step: string[]) {
    config
      .querySelectorAll<HTMLDivElement>("div[data-js-step]")
      .forEach((el) => {
        el.hidden = !step.includes(el.dataset.jsStep!);
      });
  }
  function initStep(config: HTMLFormElement, step: string) {
    switch (step) {
      case "1": {
        showSteps(config, ["1"]);
        break;
      }
      case "2": {
        clearStep(config, "3");
        showSteps(config, ["1", "2"]);
        const time = config.querySelector<HTMLInputElement>("input#time")!;
        time.valueAsNumber = 0;
        time.disabled = false;
        time.dispatchEvent(new Event("input"));
        break;
      }
      case "3": {
        clearStep(config, "3");
        showSteps(config, ["1", "3"]);
        const seed = config.querySelector<HTMLInputElement>("input#seed")!;
        seed.valueAsNumber = Math.random();
        seed.dispatchEvent(new Event("input"));
        break;
      }
      default:
        break;
    }
  }
  function clearStep(config: HTMLFormElement, step: string) {
    switch (step) {
      case "1": {
        clearStep(config, "2");
        preference.clear();
        baseDistribution = new Map();
        baseDecomposition = null;
        distribution = null;
        initStep(config, "1");
        break;
      }
      case "2": {
        clearStep(config, "3");
        const time = config.querySelector<HTMLInputElement>("input#time")!;
        time.valueAsNumber = 0;
        break;
      }
      case "3": {
        selected.clear();
        distribution = null;
        break;
      }
      default:
        break;
    }
  }

  function _getBaseDistribution(): Map<
    number,
    { id: number; value: Fraction }[]
  > {
    // Solve simultaneous eating algorithm
    const prefs: [number, number[]][] = [
      ...preference.entries().map<[number, number[]]>(([k, v]) => [k, [...v]]),
    ];
    const dist = new Map<number, { id: number; value: Fraction }[]>();
    const leftover = new Map<number, Fraction>(
      prefs.flatMap(([, items]) => items.map((id) => [id, new Fraction(1)])),
    );
    while (!leftover.values().every((v) => v.compare() <= 0)) {
      const share = new Map(leftover.entries().map(([k]) => [k, 0]));
      const stepsize = prefs.reduce<Fraction>((min, [, items]) => {
        if (items.length === 0) return min;
        while (leftover.get(items[0])!.compare() <= 0) {
          items.shift();
          if (items.length === 0) return min;
        }
        share.set(items[0], (share.get(items[0]) || 0) + 1);
        const step = Fraction.div(
          leftover.get(items[0])!,
          new Fraction(share.get(items[0])!),
        );
        if (step.compare(min) < 0) {
          min = step;
        }
        return min;
      }, new Fraction(1));
      for (const [agent, items] of prefs) {
        if (!items) continue;
        const item = items[0];
        if (!dist.has(agent)) {
          dist.set(agent, []);
        }
        dist.get(agent)!.push({ id: item, value: stepsize });
        leftover.set(item, leftover.get(item)!.sub(stepsize));
      }
    }
    const distribution = new Map<number, { id: number; value: Fraction }[]>();
    dist.forEach((dist, agent) => {
      const total = dist.reduce(
        (sum, item) => sum.add(item.value),
        new Fraction(0),
      );
      console.assert(
        total.compare(new Fraction(1)) === 0,
        `Agent ${agent} distribution does not sum to 1 (${total.toString()})`,
      );
      const elements: { id: number | null; value: Fraction }[] = [];
      let element: { id: number | null; value: Fraction } = {
        id: null,
        value: new Fraction(0),
      };
      dist.forEach((item) => {
        if (item.id === element.id) {
          element.value.add(item.value);
        } else {
          elements.push(element);
          element = { id: item.id, value: item.value.copy() };
        }
      });
      elements.push(element);
      distribution.set(
        agent,
        elements.filter((el) => el.id !== null) as {
          id: number;
          value: Fraction;
        }[],
      );
    });
    return distribution;
  }
  function getBaseDistribution(
    override: boolean = false,
  ): Map<number, { id: number; value: Fraction }[]> {
    if (!override && baseDistribution) return baseDistribution;
    baseDecomposition = null;
    distribution = null;
    return (baseDistribution = _getBaseDistribution());
  }

  function toMatrix(
    map: Map<number, { id: number; value: Fraction }[]>,
  ): Fraction[][] {
    const n = map.size;
    const matrix: Fraction[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => new Fraction(0)),
    );
    map.forEach((dist, agent) => {
      dist.forEach((item) => {
        matrix[agent][item.id] = item.value.copy();
      });
    });
    return matrix;
  }
  function fromMatrix(
    matrix: Fraction[][],
    sort_id: (i: number, a: number, b: number) => number = (_, a, b) => a - b,
  ): Map<number, { id: number; value: Fraction }[]> {
    const map = new Map<number, { id: number; value: Fraction }[]>();
    matrix.forEach((row, agent) => {
      map.set(
        agent,
        row
          .map((value, id) => ({ id, value: value.copy() }))
          .toSorted((a, b) => sort_id(agent, a.id, b.id)),
      );
    });
    return map;
  }

  function shuffleArray<T>(array: T[]): T[] {
    return array.sort(() => Math.random() - 0.5);
  }
  function HopcroftKarp(n: number, adj: number[][]) {
    const pair_u = new Array<number>(n).fill(n);
    const pair_v = new Array<number>(n).fill(n);
    const dist = new Array<number>(n + 1).fill(Infinity);
    function bfs(): boolean {
      const q = [];
      for (let u = 0; u < n; u++) {
        if (pair_u[u] === n) {
          dist[u] = 0;
          q.push(u);
        } else {
          dist[u] = Infinity;
        }
      }
      dist[n] = Infinity;
      while (q.length > 0) {
        const u = q.shift()!;
        if (dist[u] < dist[n]) {
          shuffleArray(adj[u]).forEach((v) => {
            if (dist[pair_v[v]] === Infinity) {
              dist[pair_v[v]] = dist[u]! + 1;
              q.push(pair_v[v]!);
            }
          });
        }
      }
      return dist[n] !== Infinity;
    }
    function dfs(u: number): boolean {
      if (u !== n) {
        for (const v of shuffleArray(adj[u])) {
          if (dist[pair_v[v]] === dist[u] + 1) {
            if (dfs(pair_v[v])) {
              pair_v[v] = u;
              pair_u[u] = v;
              return true;
            }
          }
        }
        dist[u] = Infinity;
        return false;
      }
      return true;
    }
    let matching = 0;
    while (bfs()) {
      for (let u = 0; u < n; u++) {
        if (pair_u[u] === n) {
          if (dfs(u)) {
            matching++;
          }
        }
      }
    }
    if (matching !== n) return null; // No perfect matching
    return { pair_u, pair_v };
  }
  function BvNDecompose(matrix: Fraction[][]): [Fraction, number[]][] {
    // Birkhoff-von Neumann decomposition
    // TODO: Maximize entropy of the permutations
    const n = matrix.length;
    if (!matrix.every((row) => row.length === n))
      throw new Error("Matrix must be square");
    if (
      !matrix.every(
        (row) =>
          row
            .reduce((sum, v) => sum.add(v), new Fraction(0))
            .compare(new Fraction(1)) === 0,
      )
    )
      throw new Error("Row sums must be 1");
    if (
      !matrix[0].every(
        (_, j) =>
          matrix
            .reduce((sum, row) => sum.add(row[j]), new Fraction(0))
            .compare(new Fraction(1)) === 0,
      )
    )
      throw new Error("Column sums must be 1");
    const A = matrix.map((row) => row.map((v) => v.copy()));
    const decomposition: [Fraction, number[]][] = []; // List of permutation matrices
    while (A.some((row) => row.some((v) => v.compare() > 0))) {
      const { pair_u } = HopcroftKarp(
        n,
        A.map((row) =>
          row.map((v, j) => (v.compare() > 0 ? j : -1)).filter((j) => j >= 0),
        ),
      )!;
      const P: number[] = [];
      for (let row = 0; row < n; row++) {
        if (pair_u[row] === n) {
          throw new Error("No perfect matching found");
        }
        P.push(pair_u[row]!);
      }

      let lambda = new Fraction(1);
      for (let row = 0; row < n; row++) {
        const col = P[row];
        if (A[row][col].compare(lambda) < 0) {
          lambda = A[row][col].copy();
        }
      }
      for (let row = 0; row < n; row++) {
        const col = P[row];
        A[row][col] = A[row][col].sub(lambda);
      }
      decomposition.push([lambda, P]);
    }
    return decomposition;
  }
  function weightedSum(entries: [Fraction, number[]][]): Fraction[][] {
    if (entries.length === 0) throw new Error("No entries to sum");
    const n = entries[0][1].length;
    const matrix: Fraction[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => new Fraction(0)),
    );
    for (const [weight, perm] of entries) {
      for (let i = 0; i < n; i++) {
        matrix[i][perm[i]] = matrix[i][perm[i]].add(weight);
      }
    }
    return matrix;
  }

  function permanent(matrix: boolean[][]): number {
    const n = matrix.length;
    if (!matrix.every((row) => row.length === n))
      throw new Error("Matrix must be square");
    let perm = 0;
    for (let s = 0; s < 1 << n; s++) {
      let prod = 1;
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          if ((s & (1 << j)) !== 0) {
            sum += matrix[i][j] ? 1 : 0;
          }
        }
        prod *= sum;
        if (prod === 0) break;
      }
      if (prod === 0) continue;
      const bits = s.toString(2).replaceAll("0", "").length;
      if (bits % 2 === 0) {
        perm += prod;
      } else {
        perm -= prod;
      }
    }
    if (n % 2 === 1) perm = -perm;
    return perm;
  }

  function getBaseDecomposition(override: boolean = false) {
    if (!override && baseDecomposition) return baseDecomposition;
    distribution = null;
    baseDecomposition = [];
    for (let i = 0; i < sample_bvn; i++) {
      const bvn = BvNDecompose(toMatrix(getBaseDistribution()));
      bvn.forEach(([weight]) => weight.mul(new Fraction(1, sample_bvn)));
      baseDecomposition.push(...bvn);
    }
    console.log("BvN Decomposition:", baseDecomposition);
    return baseDecomposition;
  }

  function _getDistribution() {
    if (selected.size === 0) {
      return getBaseDistribution();
    }

    const mode = sample_bvn <= 0 ? "exact" : "greedy";
    switch (mode) {
      case "exact": {
        const dist = toMatrix(getBaseDistribution());
        const matrix: boolean[][] = dist.map((row) =>
          row.map((v) => v.compare() > 0),
        );
        matrix.forEach((_, i) => {
          _.forEach((_, j) => {
            if (selected.has(i) && selected.get(i) === j) {
              matrix[i][j] = true;
            } else if (
              (selected.has(i) && selected.get(i) !== j) ||
              (!selected.has(i) && selected.values().some((v) => v === j))
            ) {
              matrix[i][j] = false;
            }
            dist[i][j] = new Fraction(0);
          });
        });
        const sample_space = permanent(matrix);
        matrix.forEach((_, i) => {
          _.forEach((is_edge, j) => {
            if (!is_edge) return;
            const _matrix = matrix.map((row) => [...row]);
            _matrix.forEach((_, ii) => {
              _.forEach((__, jj) => {
                if (ii === i && jj === j) return;
                if (ii === i || jj === j) {
                  _matrix[ii][jj] = false;
                }
              });
            });
            const sub_space = permanent(_matrix);
            dist[i][j] = new Fraction(sub_space, sample_space);
          });
        });
        return fromMatrix(dist, (i, a, b) => {
          const pref = preference.get(i)!;
          return pref.indexOf(a) - pref.indexOf(b);
        });
      }
      case "greedy": {
        const dec = getBaseDecomposition()
          .filter(([, perm]) =>
            perm.every((v, i) => !selected.has(i) || selected.get(i) === v),
          )
          .map(
            ([weight, perm]) =>
              [weight.copy(), [...perm]] as [Fraction, number[]],
          );

        console.log("BvN Decomposition:", dec);
        const total = dec.reduce(
          (sum, [weight]) => sum.add(weight),
          new Fraction(0),
        );
        if (total.compare() <= 0) {
          return getBaseDistribution();
        }
        dec.forEach((entry) => (entry[0] = entry[0].copy().div(total)));
        return fromMatrix(
          weightedSum(dec),
          (i, a, b) =>
            preference.get(i)!.indexOf(a) - preference.get(i)!.indexOf(b),
        );
      }
      default:
        throw new Error(`Unknown mode: ${mode}`);
        break;
    }
  }
  function getDistribution(override: boolean = false) {
    if (!override && distribution) return distribution;
    distribution = _getDistribution();
    console.log("Distribution:", distribution);
    return distribution;
  }

  function drawAll(
    ctx: CanvasRenderingContext2D,
    value: number = 1,
    index: number | null = null,
  ) {
    // TODO: Smooth animation
    // TODO: Represent each permutation and update the probability accordingly
    if (!isActive) return null;
    const distribution = getDistribution();
    const count = distribution.size;
    const n_col = 2 * Math.ceil(Math.sqrt(count / 2));
    const r = (0.5 * Math.min(ctx.canvas.width, ctx.canvas.height)) / n_col;
    const forward = new Map(
      distribution
        .entries()
        .map(([k, v]) => [
          k,
          v.map((item) => ({ id: item.id, value: item.value.number })),
        ]),
    );
    const forward_elements: Map<
      number,
      {
        offset: number;
        shift: number;
        elements: { color: string; value: number }[];
      }
    > = new Map();
    const reverse: Map<number, { id: number; value: number; at: number }[]> =
      new Map();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let agent_id = 0; agent_id < count; agent_id++) {
      let check_select = index !== null;
      const agent_color = hcl2str([
        agent_id / forward.size,
        agent_hcl[1],
        agent_hcl[2],
      ]);
      let acc = 0;
      let offset = 0;
      const elements: { color: string; value: number }[] = [];
      const dist = forward.get(agent_id) ?? [];
      for (const item of dist) {
        const item_color = hcl2str([
          (0.5 + item.id) / forward.size,
          item_hcl[1],
          item_hcl[2],
        ]);
        if (!reverse.has(item.id)) {
          reverse.set(item.id, []);
        }
        if (check_select && item.id === index) {
          offset += acc;
          check_select = false;
        }
        if (index === null && acc + item.value > value) {
          elements.push({ color: item_color, value: value - acc });
          reverse
            .get(item.id)!
            .push({ id: agent_id, value: value - acc, at: acc });
          acc = value;
          break;
        }
        elements.push({ color: item_color, value: item.value });
        reverse
          .get(item.id)!
          .push({ id: agent_id, value: item.value, at: acc });
        acc += item.value;
      }
      elements.push({ color: agent_color, value: Math.max(0, 1 - acc) });
      forward_elements.set(agent_id, { offset, shift: -offset, elements });
    }

    let selected_agent: number | null = null,
      angle = 0;
    for (let item_id = 0; item_id < count; item_id++) {
      let check_select = index === item_id;
      const i_row = n_col / 2 + Math.floor(item_id / n_col);
      const i_col = item_id % n_col;
      const x = (i_col + 0.5) * (ctx.canvas.width / n_col);
      const y = (i_row + 0.5) * (ctx.canvas.height / n_col);
      const item_color = hcl2str([
        (0.5 + item_id) / forward.size,
        item_hcl[1],
        item_hcl[2],
      ]);
      const elements: { color: string; value: number }[] = [];
      let acc = 0;
      const dist = reverse.get(item_id) ?? [];
      dist.sort((a, b) => a.at - b.at);
      for (const agent of dist) {
        const agent_color = hcl2str([
          agent.id / forward.size,
          agent_hcl[1],
          agent_hcl[2],
        ]);
        elements.push({ color: agent_color, value: agent.value });
        if (index === item_id) {
          forward_elements.get(agent.id)!.shift += acc;
        }
        if (
          check_select &&
          (acc + agent.value > value || acc + agent.value >= 1)
        ) {
          selected_agent = agent.id;
          angle += value - acc;
          check_select = false;
        }
        acc += agent.value;
      }
      elements.push({ color: item_color, value: Math.max(0, 1 - acc) });
      drawItem(
        ctx,
        elements,
        item_color,
        x,
        y,
        r * 0.1,
        r * 0.3,
        r * 0.8,
        index === item_id ? value : null,
      );
    }

    for (let agent_id = 0; agent_id < count; agent_id++) {
      const i_row = Math.floor(agent_id / n_col);
      const i_col = agent_id % n_col;
      const x = (i_col + 0.5) * (ctx.canvas.width / n_col);
      const y = (i_row + 0.5) * (ctx.canvas.height / n_col);
      const agent_color = hcl2str([
        agent_id / forward.size,
        agent_hcl[1],
        agent_hcl[2],
      ]);
      const { offset, shift, elements } = forward_elements.get(agent_id)!;
      drawItem(
        ctx,
        elements,
        agent_color,
        x,
        y,
        r * 0.1,
        r * 0.3,
        r * 0.8,
        selected_agent === agent_id ? offset + angle : null,
        shift,
      );
    }
    return { selected_agent };
  }
  function drawItem(
    ctx: CanvasRenderingContext2D,
    elements: { color: string; value: number }[],
    core_color: string,
    x: number,
    y: number,
    r0: number,
    r1: number,
    r2: number = 0,
    a: number | null = null,
    shift: number = 0,
    clockwise: boolean = true,
  ) {
    const acc = elements.reduce((sum, el) => sum + el.value, 0);
    if (acc === 0) return;
    if (!do_shift) shift = 0;
    let startAngle = shift * 2 * Math.PI;
    for (const { color, value } of elements) {
      const sliceAngle = (value / acc) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle * (clockwise ? 1 : -1);
      ctx.beginPath();
      ctx.arc(x, y, r1, startAngle, endAngle, !clockwise);
      ctx.lineTo(x + r2 * Math.cos(endAngle), y + r2 * Math.sin(endAngle));
      ctx.arc(x, y, r2, endAngle, startAngle, clockwise);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      startAngle = endAngle;
    }
    ctx.beginPath();
    ctx.arc(x, y, r0, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = core_color;
    ctx.fill();
    if (a !== null) {
      a += shift;
      a *= 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + r2 * Math.cos(a), y + r2 * Math.sin(a));
      ctx.strokeStyle = fg_col;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  return {
    start: (canvas: HTMLCanvasElement, config: HTMLFormElement) => {
      isActive = true;
      const ctx = canvas.getContext("2d")!;
      refresh_list(config);
      config
        .querySelector<HTMLInputElement>("#count")!
        .addEventListener("change", () => {
          refresh_list(config);
        });
      {
        const step =
          config.querySelector<HTMLDivElement>("[data-js-step='1']")!;
        step
          .querySelector<HTMLButtonElement>("button#calculate")!
          .addEventListener("click", () => {
            preference.clear();
            for (const dragList of dragLists) {
              preference.set(dragList.id, dragList.ids);
            }
            console.log("Preference:", preference);

            getBaseDistribution(true);
            initStep(config, "2");
          });
      }
      {
        const step =
          config.querySelector<HTMLDivElement>("[data-js-step='2']")!;
        const time = step.querySelector<HTMLInputElement>("#time")!;
        time.addEventListener("input", () => {
          const value = time.valueAsNumber;
          drawAll(ctx, value);
        });
        step
          .querySelector<HTMLButtonElement>("button#done")!
          .addEventListener("click", () => {
            time.disabled = true;
            baseDecomposition = null;
            initStep(config, "3");
          });
      }
      {
        const step =
          config.querySelector<HTMLDivElement>("[data-js-step='3']")!;
        const select = step.querySelector<HTMLSelectElement>("select#item")!;
        const seed = step.querySelector<HTMLInputElement>("input#seed")!;
        select.addEventListener("change", () => {
          seed.dispatchEvent(new Event("input"));
        });
        step
          .querySelector<HTMLButtonElement>("button#random")!
          .addEventListener("click", () => {
            seed.valueAsNumber = Math.random();
            seed.dispatchEvent(new Event("input"));
          });
        seed.addEventListener("input", () => {
          drawAll(ctx, seed.valueAsNumber, parseInt(select.value));
        });
        step
          .querySelector<HTMLButtonElement>("button#reset")!
          .addEventListener("click", () => {
            clearStep(config, "3");
            drawAll(ctx, seed.valueAsNumber, parseInt(select.value));
          });
        step
          .querySelector<HTMLButtonElement>("button#apply")!
          .addEventListener("click", () => {
            const selected_item = parseInt(select.value);
            const { selected_agent } = drawAll(
              ctx,
              seed.valueAsNumber,
              selected_item,
            )!;
            if (selected_agent !== null) {
              selected.set(selected_agent, selected_item);
              console.log("Selected:", selected);
              distribution = null;
            }
            drawAll(ctx, seed.valueAsNumber, selected_item)!;
          });
        step
          .querySelector<HTMLButtonElement>("button#apply-all")!
          .addEventListener("click", () => {
            for (let i = 0; i < select.options.length; i++) {
              select.selectedIndex = i;
              step.querySelector<HTMLButtonElement>("button#random")!.click();
              step.querySelector<HTMLButtonElement>("button#apply")!.click();
            }
          });
      }
      {
        const advanced = config.querySelector<HTMLDivElement>("div#advanced")!;
        advanced
          .querySelector<HTMLInputElement>("#sample-bvn")!
          .addEventListener("change", (e) => {
            sample_bvn = (e.target as HTMLInputElement).valueAsNumber;
            baseDecomposition = null;
            distribution = null;
            clearStep(config, "3");
          });
        sample_bvn =
          advanced.querySelector<HTMLInputElement>(
            "#sample-bvn",
          )!.valueAsNumber;
      }
    },
    stop: () => {
      isActive = false;
    },
  };
}
