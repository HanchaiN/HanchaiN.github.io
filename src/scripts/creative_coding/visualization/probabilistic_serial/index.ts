import convert_color from "@/scripts/utils/color/conversion.js";
import type { OKHCLColor } from "@/scripts/utils/color/conversion.ts";
import { DragListY } from "@/scripts/utils/dom/element/DragListY.js";
import { Fraction } from "@/scripts/utils/math/fraction.js";

const okhcl2str = convert_color("okhcl", "hex")!;

export default function execute() {
  let isActive: boolean = false;
  const agent_hcl: OKHCLColor = [0, 0.2, 0.6];
  const item_hcl: OKHCLColor = [0, 0.2, 0.4];
  let dragLists: DragListY[] = [];
  let distribution: Map<number, { id: number; value: Fraction }[]> | null =
    null;

  function refresh_list(config: HTMLFormElement) {
    const count =
      config.querySelector<HTMLInputElement>("#count")!.valueAsNumber;
    const lists = config.querySelector("#lists")!;
    lists.innerHTML = "";
    dragLists = [];
    for (let i = 0; i < count; i++) {
      const label = document.createElement("label");
      const ol = document.createElement("ol");
      ol.id = label.htmlFor = `list-a${i}`;
      label.textContent = `Agent ${i}:`;
      label.style.color = okhcl2str([i / count, agent_hcl[1], agent_hcl[2]]);
      lists.appendChild(label);
      const dragList = new DragListY(
        ol,
        count,
        (id) => {
          const item = document.createElement("li");
          item.textContent = `Item ${id}`;
          item.style.color = okhcl2str([
            (0.5 + id) / count,
            item_hcl[1],
            item_hcl[2],
          ]);
          return item;
        },
        i,
      );
      dragLists.push(dragList);
      lists.appendChild(ol);
    }
  }

  function getDistribution(
    preference: Map<number, number[]>,
  ): Map<number, { id: number; value: Fraction }[]> {
    // Solve simultaneous eating algorithm
    const prefs = [...preference.entries()];
    const dist = new Map<number, { id: number; value: Fraction }[]>();
    const leftover = new Array(prefs.length)
      .fill(1)
      .map((v) => new Fraction(v));
    while (leftover.some((v) => v.compare() > 0)) {
      const share = leftover.map(() => 0);
      const stepsize = prefs.reduce<Fraction>((min, [, items]) => {
        if (items.length === 0) return min;
        while (leftover[items[0]].compare() <= 0) {
          items.shift();
          if (items.length === 0) return min;
        }
        share[items[0]]++;
        const step = Fraction.div(
          leftover[items[0]],
          new Fraction(share[items[0]]),
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
        leftover[item].sub(stepsize);
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

  function drawAll(
    ctx: CanvasRenderingContext2D,
    distribution: Map<number, { id: number; value: Fraction }[]>,
    value: number = 1,
  ) {
    if (!isActive) return;
    const count = distribution.size;
    const forward = new Map(
      distribution
        .entries()
        .map(([k, v]) => [
          k,
          v.map((item) => ({ id: item.id, value: item.value.number })),
        ]),
    );
    const reverse: Map<number, { id: number; value: number; at: number }[]> =
      new Map();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let agent_id = 0; agent_id < count; agent_id++) {
      const x = (ctx.canvas.width / forward.size) * (0.5 + agent_id);
      const y = (ctx.canvas.height / 2) * 0.5;
      const r =
        Math.min(
          (0.5 * ctx.canvas.width) / forward.size,
          (0.5 * ctx.canvas.height) / 2,
        ) * 0.8;
      const agent_color = okhcl2str([
        agent_id / forward.size,
        agent_hcl[1],
        agent_hcl[2],
      ]);
      let acc = 0;
      const elements: { color: string; value: number }[] = [];
      const dist = forward.get(agent_id) ?? [];
      for (const item of dist) {
        const item_color = okhcl2str([
          (0.5 + item.id) / forward.size,
          item_hcl[1],
          item_hcl[2],
        ]);
        if (!reverse.has(item.id)) {
          reverse.set(item.id, []);
        }
        if (acc + item.value > value) {
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
      drawItem(ctx, elements, agent_color, x, y, r * 0.1, r, r * 0.3);
    }

    for (let item_id = 0; item_id < count; item_id++) {
      const x = (ctx.canvas.width / forward.size) * (0.5 + item_id);
      const y = (ctx.canvas.height / 2) * 1.5;
      const r =
        Math.min(
          (0.5 * ctx.canvas.width) / forward.size,
          (0.5 * ctx.canvas.height) / 2,
        ) * 0.8;
      const item_color = okhcl2str([
        (0.5 + item_id) / forward.size,
        item_hcl[1],
        item_hcl[2],
      ]);
      const elements: { color: string; value: number }[] = [];
      let acc = 0;
      const dist = reverse.get(item_id) ?? [];
      dist.sort((a, b) => a.at - b.at);
      for (const agent of dist) {
        const agent_color = okhcl2str([
          agent.id / forward.size,
          agent_hcl[1],
          agent_hcl[2],
        ]);
        elements.push({ color: agent_color, value: agent.value });
        acc += agent.value;
      }
      elements.push({ color: item_color, value: Math.max(0, 1 - acc) });
      drawItem(ctx, elements, item_color, x, y, r * 0.1, r, r * 0.3);
    }
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
    clockwise: boolean = true,
  ) {
    const acc = elements.reduce((sum, el) => sum + el.value, 0);
    if (acc === 0) return;
    let startAngle = 0;
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
      config
        .querySelector<HTMLButtonElement>("#apply")!
        .addEventListener("click", () => {
          const preference: Map<number, number[]> = new Map();
          for (const dragList of dragLists) {
            preference.set(dragList.id, dragList.ids);
          }
          distribution = getDistribution(preference);
          console.log(distribution, preference);
          drawAll(ctx, distribution, 0);
          config.querySelector<HTMLInputElement>("#time")!.valueAsNumber = 0;
        });
      config
        .querySelector<HTMLInputElement>("#time")!
        .addEventListener("input", (e) => {
          const value = (e.target as HTMLInputElement).valueAsNumber;
          if (distribution === null) return;
          drawAll(ctx, distribution, value);
        });
    },
    stop: () => {
      isActive = false;
    },
  };
}
