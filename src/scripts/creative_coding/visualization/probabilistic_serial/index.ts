import convert_color from "@/scripts/utils/color/conversion.js";
import type { OKHCLColor } from "@/scripts/utils/color/conversion.ts";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { DragListY } from "@/scripts/utils/dom/element/DragListY.js";
import { Fraction } from "@/scripts/utils/math/fraction.js";

const okhcl2str = convert_color("okhcl", "hex")!;

export default function execute() {
  let isActive: boolean = false;
  const agent_hcl: OKHCLColor = [0, 0.2, 0.6];
  const item_hcl: OKHCLColor = [0, 0.4, 0.4];
  const fg_col: string = getPaletteBaseColor(1);
  let do_shift: boolean = false;
  let dragLists: DragListY[] = [];
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
      label.style.color = okhcl2str([i / count, agent_hcl[1], agent_hcl[2]]);
      list.appendChild(label);
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
      list.appendChild(ol);
      lists.appendChild(list);
      const option = document.createElement("option");
      option.value = `${i}`;
      option.textContent = `Item ${i}`;
      select.appendChild(option);
    }
    setStep(config, ["1"]);
  }

  function setStep(config: HTMLFormElement, step: string[]) {
    config
      .querySelectorAll<HTMLDivElement>("div[data-js-step]")
      .forEach((el) => {
        el.hidden = !step.includes(el.dataset.jsStep!);
        if (el.hidden) return;
        switch (el.dataset.jsStep!) {
          case "1":
            break;
          case "2": {
            const time = config.querySelector<HTMLInputElement>("input#time")!;
            time.valueAsNumber = 0;
            time.disabled = false;
            break;
          }
          case "3": {
            selected.clear();
            const do_shift_input =
              config.querySelector<HTMLInputElement>("input#shift")!;
            do_shift = do_shift_input.checked = false;
            do_shift_input.disabled = false;
            break;
          }
          default:
            break;
        }
      });
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
    value: number = 1,
    index: number | null = null,
  ) {
    if (!isActive || distribution === null) return null;
    const count = distribution.size;
    const n_col = 2 * Math.ceil(Math.sqrt(count / 2));
    const r = (0.5 * Math.min(ctx.canvas.width, ctx.canvas.height)) / n_col;
    const forward = new Map(
      distribution.entries().map(([k, v]) => {
        const v_ = v
          .filter((item) =>
            selected.has(k)
              ? item.id === selected.get(k)
              : selected.values().every((id) => item.id !== id),
          )
          .map((item) => ({ id: item.id, value: item.value.number }));
        const total = v_.reduce((sum, item) => sum + item.value, 0);
        if (total > 0) {
          v_.forEach((item) => (item.value /= total));
        }
        return [k, v_];
      }),
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
      const agent_color = okhcl2str([
        agent_id / forward.size,
        agent_hcl[1],
        agent_hcl[2],
      ]);
      let acc = 0;
      let offset = 0;
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
        if (index === item_id) {
          forward_elements.get(agent.id)!.shift += acc;
        }
        if (check_select && acc + agent.value > value) {
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
      const agent_color = okhcl2str([
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
    return selected_agent;
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
            const preference: Map<number, number[]> = new Map();
            for (const dragList of dragLists) {
              preference.set(dragList.id, dragList.ids);
            }
            distribution = getDistribution(preference);
            console.log(distribution, preference);
            setStep(config, ["1", "2"]);
            const value = (
              config.querySelector<HTMLInputElement>(
                "#time",
              ) as HTMLInputElement
            ).valueAsNumber;
            drawAll(ctx, value);
          });
      }
      {
        const step =
          config.querySelector<HTMLDivElement>("[data-js-step='2']")!;
        const time = step.querySelector<HTMLInputElement>("#time")!;
        time.addEventListener("input", () => {
          if (distribution === null) return;
          const value = time.valueAsNumber;
          drawAll(ctx, value);
        });
        step
          .querySelector<HTMLButtonElement>("button#done")!
          .addEventListener("click", () => {
            time.disabled = true;
            if (distribution === null) return;
            setStep(config, ["1", "3"]);
            drawAll(ctx);
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
            setStep(config, ["1", "3"]);
            drawAll(ctx);
          });
        step
          .querySelector<HTMLButtonElement>("button#apply")!
          .addEventListener("click", () => {
            const selected_item = parseInt(select.value);
            const selected_agent = drawAll(
              ctx,
              seed.valueAsNumber,
              selected_item,
            );
            if (selected_agent !== null) {
              selected.set(selected_agent, selected_item);
            }
            drawAll(ctx);
          });
        step
          .querySelector<HTMLInputElement>("input#shift")!
          .addEventListener("change", (e) => {
            do_shift = (e.target as HTMLInputElement).checked;
            drawAll(ctx);
          });
      }
    },
    stop: () => {
      isActive = false;
    },
  };
}
