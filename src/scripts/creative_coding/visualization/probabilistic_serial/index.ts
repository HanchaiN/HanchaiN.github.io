import convert_color from "@/scripts/utils/color/conversion.js";
import type { HCLColor } from "@/scripts/utils/color/conversion.ts";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { DragListY } from "@/scripts/utils/dom/element/DragListY.js";
import { Fraction } from "@/scripts/utils/math/fraction.js";
import { shuffleArray } from "@/scripts/utils/math/random.js";
import { sum } from "@/scripts/utils/math/utils.js";
import { Namespace } from "@/scripts/utils/namespace.js";

import {
  HopcroftKarp,
  SinkhornFrac as Sinkhorn,
  BvNDecomposeFrac as _BvNDecompose,
  preTransverse as __preTransverse,
  samplePairing as _samplePairing,
  permanentFrac as permanent,
  toAdjList,
  toAdjMatrix,
} from "./perfect_pair.js";

const hcl2str = convert_color("hcl", "hex")!;

export default function execute() {
  let isActive: boolean = false;
  const agent_hcl: HCLColor = [0, 0.7, 0.7];
  const item_hcl: HCLColor = [0, 0.7, 0.3];
  const fg_col: string = getPaletteBaseColor(1);
  const do_shift: boolean = false;
  let dragLists: DragListY[] = [];

  type TCache = {
    preference: Map<number, number[]>;
    baseDistribution: Map<number, { id: number; value: Fraction }[]>;
    sample_perm: number;
    algo: "naive" | "count" | "greedy" | "sample";
    baseDecomposition: [Fraction, number[]][];
    baseSample: number[][];
    selected: Map<number, number>;
    distribution: Map<number, { id: number; value: Fraction }[]>;
  };
  const cache = Namespace.create<TCache>();

  function refresh_list(config: HTMLFormElement) {
    const count =
      config.querySelector<HTMLInputElement>("#count")!.valueAsNumber;
    const lists = config.querySelector<HTMLDivElement>("div#lists")!;
    lists.textContent = "";
    const select = config.querySelector<HTMLSelectElement>("select#item")!;
    select.textContent = "";
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
        cache.set("preference", new Map());
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
        cache.set("selected", new Map());
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
        cache.remove("preference");
        break;
      }
      case "2": {
        clearStep(config, "3");
        const time = config.querySelector<HTMLInputElement>("input#time")!;
        time.valueAsNumber = 0;
        break;
      }
      case "3": {
        cache.remove("selected");
        break;
      }
      default:
        break;
    }
  }

  cache.setGen(
    "baseDistribution",
    function _getBaseDistribution(
      cache,
    ): Map<number, { id: number; value: Fraction }[]> {
      const preference = cache.get("preference");
      if (!preference) throw new Error("Preference not set");
      // Solve simultaneous eating algorithm
      const prefs: [number, number[]][] = [
        ...preference
          .entries()
          .map<[number, number[]]>(([k, v]) => [k, [...v]]),
      ];
      const dist = new Map<number, { id: number; value: Fraction }[]>();
      const leftover = new Map<number, Fraction>(
        prefs.flatMap(([, items]) => items.map((id) => [id, new Fraction(1)])),
      );
      while (!leftover.values().every((v) => v.compare() <= 0)) {
        const share = new Map(leftover.entries().map(([k]) => [k, 0]));
        const stepsize = prefs.reduce((min, [, items]) => {
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
    },
    false,
  );

  const preTransverseCache = new Map();
  function _preTransverse(
    activity: Fraction[][],
    sample_size: number,
    steps: number,
  ) {
    const key = JSON.stringify({ activity });
    if (preTransverseCache.has(key)) return preTransverseCache.get(key);
    if (preTransverseCache.size > 100)
      preTransverseCache.delete(preTransverseCache.keys().next().value);
    const result = __preTransverse(
      activity.map((row) => row.map((v) => v.number)),
      sample_size,
      steps,
    );
    preTransverseCache.set(key, result);
    return result;
  }
  function clearPreTransverseCache() {
    preTransverseCache.clear();
  }
  function samplePairing(
    activity: Fraction[][],
    steps: number = -1,
    pre_sample_size: number = -10,
    pre_steps: number = -10,
  ) {
    if (pre_steps <= 0) pre_steps = steps;
    if (steps === 0) {
      const n = activity.length;
      const sample = HopcroftKarp(
        n,
        activity.map((row) =>
          row.map((v, j) => (v.compare() > 0 ? j : -1)).filter((j) => j >= 0),
        ),
      )?.pair_u;
      if (!sample) throw new Error("No perfect matching found");
      return sample;
    }
    const weight = _preTransverse(activity, pre_sample_size, pre_steps);
    return _samplePairing(
      activity.map((row) => row.map((v) => v.number)),
      weight,
      steps,
    );
  }

  function BvNDecompose(matrix: Fraction[][]): [Fraction, number[]][] {
    return _BvNDecompose(
      matrix,
      // (m) => samplePairing(m.map(r => r.map(c => c ? new Fraction(1) : new Fraction(0))), 10, 10),
    );
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

  cache.setGen(
    "baseDecomposition",
    function _getBaseDecomposition(cache) {
      const sample_perm = cache.get("sample_perm");
      if (sample_perm === null) throw new Error("sample_perm not set");
      const baseDistribution = cache.get("baseDistribution");
      if (!baseDistribution) throw new Error("baseDistribution not set");
      const matrix = toAdjMatrix(baseDistribution);
      const baseDecomposition = [];
      for (let i = 0; i < sample_perm; i++) {
        const bvn = BvNDecompose(matrix);
        bvn.forEach(([weight]) => weight.mul(new Fraction(1, sample_perm)));
        baseDecomposition.push(...bvn);
      }
      console.log("BvN Decomposition:", baseDecomposition);
      return baseDecomposition;
    },
    false,
  );

  cache.setGen(
    "baseSample",
    function _getBaseSample(cache) {
      const sample_perm = cache.get("sample_perm");
      if (sample_perm === null) throw new Error("sample_perm not set");
      const baseDistribution = cache.get("baseDistribution");
      if (!baseDistribution) throw new Error("baseDistribution not set");
      const matrix = toAdjMatrix(baseDistribution);
      const baseSample = [];
      for (let i = 0; i < sample_perm; i++) {
        baseSample.push(samplePairing(matrix));
      }
      console.log("Sampled permutations:", baseSample);
      return baseSample;
    },
    false,
  );

  function count_events(matrix: Fraction[][]) {
    const sample = permanent(
      matrix.map((row) =>
        row.map((v) => (v.compare() > 0 ? new Fraction(1) : new Fraction(0))),
      ),
    );
    const events = matrix.map((row) => row.map(() => new Fraction(0)));
    matrix.forEach((_, i) => {
      _.forEach((v, j) => {
        if (v.compare() <= 0) return;
        const _matrix = matrix.map((row) => [...row.map((v) => v.copy())]);
        _matrix.forEach((_, ii) => {
          _.forEach((__, jj) => {
            if (ii === i) {
              _matrix[ii][jj] = jj === j ? new Fraction(1) : new Fraction(0);
            } else {
              _matrix[ii][jj] =
                _matrix[ii][jj].compare() > 0
                  ? new Fraction(1)
                  : new Fraction(0);
            }
          });
        });
        const sub_space = permanent(_matrix);
        events[i][j] = sub_space;
      });
    });
    return { sample, events };
  }
  cache.setGen(
    "distribution",
    function _getDistribution(cache) {
      const selected = cache.get("selected");
      if (selected === null) return cache.get("baseDistribution")!;
      const sample_perm = cache.get("sample_perm");
      if (sample_perm === null) throw new Error("sample_perm not set");
      switch (cache.get("algo")) {
        case "naive": {
          console.warn("Naive mode is incorrect, do not use");
          const preference = cache.get("preference");
          const dist = toAdjMatrix(cache.get("baseDistribution")!);
          dist.forEach((_, i) => {
            _.forEach((_, j) => {
              if (selected!.has(i) && selected!.get(i) === j) {
                dist[i][j] = new Fraction(1);
              } else if (
                (selected!.has(i) && selected!.get(i) !== j) ||
                (!selected!.has(i) && selected!.values().some((v) => v === j))
              ) {
                dist[i][j] = new Fraction(0);
              }
            });
          });
          Sinkhorn(dist);
          return toAdjList(dist, (i, a, b) => {
            const pref = preference?.get(i);
            if (!pref) return 0;
            return pref.indexOf(a) - pref.indexOf(b);
          });
        }
        case "count": {
          const preference = cache.get("preference");
          const dist = toAdjMatrix(cache.get("baseDistribution")!);
          const matrix: Fraction[][] = dist.map((row) =>
            row.map((v) => (v.compare() > 0 ? v.copy() : new Fraction(0))),
          );
          const { sample: n_preselect, events: ns_preselect } =
            count_events(matrix);
          matrix.forEach((_, i) => {
            _.forEach((_, j) => {
              if (selected!.has(i) && selected!.get(i) === j) {
                matrix[i][j] = new Fraction(1);
              } else if (
                (selected!.has(i) && selected!.get(i) !== j) ||
                (!selected!.has(i) && selected!.values().some((v) => v === j))
              ) {
                matrix[i][j] = new Fraction(0);
              }
            });
          });
          const { sample: n_postselect, events: ns_postselect } =
            count_events(matrix);
          console.log("Event counts:", {
            n_postselect,
            ns_postselect,
            n_preselect,
            ns_preselect,
          });
          console.log("Base distribution:", matrix);
          dist.forEach((row, i) => {
            row.forEach((_, j) => {
              if (selected!.has(i) && selected!.get(i) === j) {
                dist[i][j] = new Fraction(1);
              } else if (selected!.has(i)) {
                dist[i][j] = new Fraction(0);
              } else if (selected!.values().some((v) => v === j)) {
                dist[i][j] = new Fraction(0);
              } else if (ns_preselect[i][j].compare() === 0) {
                dist[i][j] = new Fraction(0);
              } else {
                dist[i][j] = Fraction.div(
                  ns_postselect[i][j],
                  ns_preselect[i][j],
                ).mul(dist[i][j]);
              }
            });
          });
          console.log(
            "Pre-distribution:",
            dist.map((r) => r.map((v) => v.toString())),
          );
          Sinkhorn(dist); // FIXME: Learn probability theory and make the normalization correct in the first place
          return toAdjList(dist, (i, a, b) => {
            const pref = preference?.get(i);
            if (!pref) return 0;
            return pref.indexOf(a) - pref.indexOf(b);
          });
        }
        case "greedy": {
          const preference = cache.get("preference");
          const dec = cache
            .get("baseDecomposition")!
            .filter(([, perm]) =>
              perm.every((v, i) => !selected!.has(i) || selected!.get(i) === v),
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
          dec.forEach((entry) => (entry[0] = entry[0].copy().div(total)));
          return toAdjList(weightedSum(dec), (i, a, b) => {
            const pref = preference?.get(i);
            if (!pref) return 0;
            return pref.indexOf(a) - pref.indexOf(b);
          });
        }
        case "sample": {
          const preference = cache.get("preference");
          const samp = cache
            .get("baseSample")!
            .filter((perm) =>
              perm.every((v, i) => !selected!.has(i) || selected!.get(i) === v),
            );
          console.log("Sampled permutations:", samp);
          const dist = new Map<number, { id: number; value: Fraction }[]>();
          samp.forEach((perm) => {
            perm.forEach((v, i) => {
              if (!dist.has(i)) {
                dist.set(i, []);
              }
              const item = dist.get(i)!.find((el) => el.id === v);
              if (item) {
                item.value.add(new Fraction(1, samp.length));
              } else {
                dist
                  .get(i)!
                  .push({ id: v, value: new Fraction(1, samp.length) });
              }
            });
          });
          dist.forEach((d, i) => {
            const pref = preference?.get(i);
            d.sort((a, b) => {
              if (!pref) return a.value.number - b.value.number;
              return pref.indexOf(a.id) - pref.indexOf(b.id);
            });
          });
          return dist;
        }
        default:
          throw new Error(`Unknown mode: ${cache.get("algo")}`);
      }
    },
    false,
  );

  function drawAll(
    ctx: CanvasRenderingContext2D,
    value: number = 1,
    index: number | null = null,
  ) {
    // TODO: Smooth animation
    if (!isActive) return null;
    const distribution = cache.get("distribution")!;
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
    const acc = sum(elements.map(({ value }) => value));
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
          .querySelector<HTMLButtonElement>("button#shuffle")!
          .addEventListener("click", () => {
            dragLists.forEach(
              (dragList) => (dragList.ids = shuffleArray(dragList.ids)),
            );
          });
        step
          .querySelector<HTMLButtonElement>("button#calculate")!
          .addEventListener("click", () => {
            cache.set("preference", new Map());
            const preference = cache.get("preference")!;
            for (const dragList of dragLists) {
              preference.set(dragList.id, dragList.ids);
            }
            console.log("Preference:", preference);
            initStep(config, "2");
            cache.updated("preference");
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
            initStep(config, "3");
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
              cache.get("selected")?.set(selected_agent, selected_item);
              console.log("Selected:", cache.get("selected"));
              cache.updated("selected");
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
        {
          const advanced = config.querySelector("#advanced")!;
          advanced
            .querySelector<HTMLInputElement>("input#sample-perm")!
            .addEventListener("change", () => {
              cache.refresh("sample_perm");
              drawAll(ctx, seed.valueAsNumber, parseInt(select.value))!;
            });
          cache.setGen(
            "sample_perm",
            () =>
              advanced.querySelector<HTMLInputElement>("#sample-perm")!
                .valueAsNumber,
          );
          advanced
            .querySelector<HTMLSelectElement>("select#algo")!
            .addEventListener("change", () => {
              cache.refresh("algo");
              drawAll(ctx, seed.valueAsNumber, parseInt(select.value))!;
            });
          cache.setGen(
            "algo",
            () =>
              advanced.querySelector<HTMLSelectElement>("#algo")!
                .value as TCache["algo"],
          );
          advanced
            .querySelector<HTMLButtonElement>("button#clear-cache")!
            .addEventListener("click", () => {
              clearPreTransverseCache();
              cache.updated("preference");
              drawAll(ctx, seed.valueAsNumber, parseInt(select.value))!;
            });
        }
      }
    },
    stop: () => {
      isActive = false;
    },
  };
}
