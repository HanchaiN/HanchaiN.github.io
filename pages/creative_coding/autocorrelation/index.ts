import {
  getNoteColor,
  getNoteString,
  type TNote,
} from "@/utils/audio_processing.js";
import { getPaletteBaseColor } from "@/utils/color/palette.js";
import { startAnimationLoop } from "@/utils/dom/utils.js";
import { map } from "@/utils/math/utils.js";

import { autocorrelation_yin, normalize, rescale_yin } from "./pipeline.js";

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let isActive = false;
  let bufferArray: Float32Array<ArrayBuffer>;
  let audioCtx: AudioContext;
  let audioSource: MediaStreamAudioSourceNode;
  let analyser: AnalyserNode;
  let gainNode: GainNode;
  let sampleRate: number;
  const HIST_SIZE = Math.pow(2, 12);
  const BIN_COUNT = Math.pow(2, 9);

  const minFreq = 27.5,
    maxFreq = (3520 * 5) / 4;
  const softThreshold = 0.15;
  const hardThreshold = 0.5;

  function clear() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "30px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Hello, World!", ctx.canvas.width / 2, ctx.canvas.height / 2);
  }
  async function setup() {
    audioCtx = new AudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
    audioSource = audioCtx.createMediaStreamSource(stream);
    sampleRate =
      audioSource.mediaStream.getAudioTracks()[0]?.getSettings()?.sampleRate ??
      audioCtx.sampleRate ??
      44100;
    gainNode = audioCtx.createGain();
    analyser = audioCtx.createAnalyser();
    audioSource.connect(gainNode);
    gainNode.connect(analyser);
    gainNode.gain.value = 1;
    bufferArray = new Float32Array((analyser.fftSize = HIST_SIZE));

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  function draw() {
    if (!isActive) return false;
    analyser.getFloatTimeDomainData(bufferArray);
    ctx.fillStyle = getPaletteBaseColor(0);
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const normBuff = normalize(bufferArray);
    {
      const l = -2,
        h = 2;
      ctx.strokeStyle = getPaletteBaseColor(0.5);
      ctx.beginPath();
      for (let k = 0; k < BIN_COUNT; k++) {
        const x = map(k, 0, BIN_COUNT, 0, ctx.canvas.width);
        const y = map(normBuff[k]!, l, h, ctx.canvas.height, 0);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const d = autocorrelation_yin(normBuff, BIN_COUNT);
    {
      const l = -0.25,
        h = 2.25;
      ctx.strokeStyle = getPaletteBaseColor(0.75);
      ctx.beginPath();
      for (let k = 0; k < BIN_COUNT; k++) {
        const x = map(k, 0, BIN_COUNT, 0, ctx.canvas.width);
        const y = map(d[k]!, l, h, ctx.canvas.height, 0);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const cmndf = rescale_yin(d);
    {
      const l = -0.25,
        h = 2.25;
      ctx.strokeStyle = getPaletteBaseColor(1.0);
      ctx.beginPath();
      for (let k = 0; k < BIN_COUNT; k++) {
        const x = map(k, 0, BIN_COUNT, 0, ctx.canvas.width);
        const y = map(cmndf[k]!, l, h, ctx.canvas.height, 0);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const minLag = Math.floor(sampleRate / maxFreq);
      const maxLag = Math.min(
        Math.floor(sampleRate / minFreq),
        Math.floor(bufferArray.length / 2),
      );

      let bestTau: number | null = null;
      ctx.fillStyle = "blue";
      for (let tau = minLag; tau <= maxLag; tau++) {
        if (cmndf[tau]! < softThreshold) {
          while (tau + 1 <= maxLag && cmndf[tau + 1]! < cmndf[tau]!) tau++;
          ctx.beginPath();
          ctx.arc(
            map(tau, 0, BIN_COUNT, 0, ctx.canvas.width),
            map(cmndf[tau]!, l, h, ctx.canvas.height, 0),
            5,
            0,
            2 * Math.PI,
          );
          ctx.fill();
          bestTau ??= tau;
        }
      }
      ctx.fillStyle = "green";
      if (bestTau === null) {
        let minVal = Infinity;
        for (let tau = minLag; tau <= maxLag; tau++) {
          if (cmndf[tau]! < minVal) {
            ctx.beginPath();
            ctx.arc(
              map(tau, 0, BIN_COUNT, 0, ctx.canvas.width),
              map(cmndf[tau]!, l, h, ctx.canvas.height, 0),
              5,
              0,
              2 * Math.PI,
            );
            ctx.fill();
            minVal = cmndf[tau]!;
            bestTau = tau;
          }
        }
        if (minVal >= hardThreshold) bestTau = null;
      }
      if (bestTau !== null) {
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(
          map(bestTau, 0, BIN_COUNT, 0, ctx.canvas.width),
          map(cmndf[bestTau]!, l, h, ctx.canvas.height, 0),
          5,
          0,
          2 * Math.PI,
        );
        ctx.fill();

        let T0 = bestTau;
        let S0 = cmndf[bestTau]!;
        if (bestTau > 0 && bestTau < maxLag) {
          const s0 = cmndf[bestTau - 1]!,
            s1 = cmndf[bestTau]!,
            s2 = cmndf[bestTau + 1]!;
          const a = (s0 + s2 - 2 * s1) / 2;
          const b = (s0 - s2) / 2;
          if (a > 0) {
            T0 = T0 - b / (2 * a);
            S0 = S0; // - (2 * b * b - b) / (4 * a);
          }
        }
        ctx.fillStyle = "yellow";
        ctx.beginPath();
        ctx.arc(
          map(T0, 0, BIN_COUNT, 0, ctx.canvas.width),
          map(S0, l, h, ctx.canvas.height, 0),
          3,
          0,
          2 * Math.PI,
        );
        ctx.fill();

        {
          const freq = sampleRate / T0,
            confidence = 1 - S0;
          if (confidence > 0) {
            const note = getNoteString(freq, true);
            ctx.fillStyle = getNoteColor(note.slice(0, 2) as TNote);
            ctx.font = "15px monospace";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(
              `Note: ${note}; Freq: ${freq.toFixed(2).padStart(7)}Hz (${(100 * confidence).toFixed(2).padStart(5)}%)`,
              0,
              20,
            );
          }
        }
      }
    }

    return true;
  }

  return {
    start: async (sketch: HTMLCanvasElement, form: HTMLFormElement) => {
      canvas = sketch;
      ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;
      clear();
      form
        .querySelector("#start")!
        .addEventListener("click", async function start() {
          await setup();
          if (!isActive) {
            isActive = true;
            startAnimationLoop(draw);
          }
        });
    },
    stop: () => {
      isActive = false;
      canvas?.remove();
    },
  };
}
