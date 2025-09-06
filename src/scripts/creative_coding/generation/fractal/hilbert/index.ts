import convert_color from "@/scripts/utils/color/conversion.js";
import {
  getPaletteAccentColor,
  getPaletteBaseColor,
} from "@/scripts/utils/color/palette.js";
import { kernelGenerator } from "@/scripts/utils/dom/kernelGenerator.js";
import type { IKernelFunctionThis } from "@/scripts/utils/dom/kernelGenerator.ts";
import {
  getMousePos,
  startAnimationLoop,
  startLoop,
} from "@/scripts/utils/dom/utils.js";
import { lerp } from "@/scripts/utils/math/utils.js";

import { rot_hilbert as rot, xy2d } from "./hilbert.js";

const okhcl2srgb = convert_color("okhcl", "srgb")!,
  str2okhcl = convert_color("str", "okhcl")!;

export default function execute() {
  let audioContext: AudioContext, gainNode: GainNode, oscl: OscillatorNode;
  let isActive: boolean = false;
  const iter = 512;

  interface IConstants {
    c: number;
    l: number;
  }

  function main(this: IKernelFunctionThis<IConstants>, n: number) {
    const d = xy2d(n, this.thread.x, this.thread.y, rot);
    const v = (1.0 * d) / (n * n);
    const c = okhcl2srgb([
      v,
      this.constants.c as number,
      this.constants.l as number,
    ]);
    this.color(...c, 1);
  }

  return {
    start: (canvas: HTMLCanvasElement) => {
      isActive = true;
      const n = Math.pow(
        2,
        Math.ceil(Math.log2(Math.max(canvas.width, canvas.height))),
      );
      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      })!;
      canvas.width = n;
      canvas.height = n;
      ctx.fillStyle = getPaletteBaseColor(0);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const buffer = ctx.getImageData(0, 0, canvas.width, canvas.height, {
        colorSpace: "srgb",
      });
      const ref = str2okhcl(getPaletteAccentColor(0));
      const renderer = kernelGenerator(
        main,
        {
          c: ref[1],
          l: ref[2],
        },
        buffer,
      );
      const step = renderer(n);
      let done = false;
      startLoop(function update() {
        if (!isActive) return false;
        for (let _ = 0; _ < iter; _++) {
          const res = step.next();
          if (res.done) {
            done = true;
            break;
          }
        }
        return !done;
      });
      startAnimationLoop(async function draw() {
        if (!isActive) return false;
        await createImageBitmap(buffer).then((bmp) =>
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height),
        );
        return !done;
      });
      canvas.addEventListener("mousedown", (e) => {
        if (typeof audioContext === "undefined") {
          audioContext = new AudioContext();
          gainNode = new GainNode(audioContext);
          oscl = new OscillatorNode(audioContext, {
            type: "sine",
          });
          gainNode.gain.value = 0;
          gainNode.connect(audioContext.destination);
          oscl.connect(gainNode);
          oscl.start();
        }
        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        function onMouseMove(e: MouseEvent) {
          const { x, y } = getMousePos(canvas, e);
          const v = xy2d(n, x, canvas.height - y, rot) / (n * n);
          oscl.frequency.value = Math.exp(lerp(v, Math.log(85), Math.log(255)));
        }
        function onMouseLeave() {
          canvas.removeEventListener("mousemove", onMouseMove);
          canvas.removeEventListener("mouseup", onMouseLeave);
          canvas.removeEventListener("mouseleave", onMouseLeave);
          gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.1);
        }
        onMouseMove(e);
        canvas.addEventListener("mousemove", onMouseMove);
        canvas.addEventListener("mouseup", onMouseLeave);
        canvas.addEventListener("mouseleave", onMouseLeave);
      });
    },
    stop: () => {
      isActive = false;
    },
  };
}
