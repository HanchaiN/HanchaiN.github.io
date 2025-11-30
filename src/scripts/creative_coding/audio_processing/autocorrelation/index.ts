import {
  getNoteColor,
  getNoteString,
} from "@/scripts/utils/audio_processing.js";
import type { TNote } from "@/scripts/utils/audio_processing.ts";
import { getPaletteBaseColor } from "@/scripts/utils/color/palette.js";
import { startAnimationLoop } from "@/scripts/utils/dom/utils.js";
import { lerp, map } from "@/scripts/utils/math/utils.js";

import {
  autocorrelation,
  extractPeaks,
  extractPeriod,
  filterPeaks,
} from "./pipeline.js";

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
  const BIN_COUNT = Math.pow(2, 10);
  const THRESHOLD_FRAC = 0.8;
  const SMOOTHEN_COUNT = 3;

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
      audioSource.mediaStream.getAudioTracks()[0].getSettings().sampleRate ??
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
    let corr = bufferArray;
    {
      let i = 0;
      while (true) {
        ctx.strokeStyle = getPaletteBaseColor(lerp(i / SMOOTHEN_COUNT, 0.5, 1));
        ctx.beginPath();
        for (let k = 0; k < BIN_COUNT; k++) {
          const x = map(k, 0, BIN_COUNT, 0, ctx.canvas.width);
          const y = map(corr[k], -1, 1, ctx.canvas.height, 0);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        if (i < SMOOTHEN_COUNT)
          corr = autocorrelation(corr, BIN_COUNT); // smoothen
        else break;
        i++;
      }
    }
    const corr2 = corr.map((v) => v * v);
    let peaks = extractPeaks(corr2);
    for (let j = 1; j < peaks.length; j++) {
      const k = peaks[j];
      ctx.fillStyle = "blue";
      ctx.beginPath();
      ctx.arc(
        map(k, 0, BIN_COUNT, 0, ctx.canvas.width),
        map(corr[k], -1, 1, ctx.canvas.height, 0),
        5,
        0,
        2 * Math.PI,
      );
      ctx.fill();
    }
    peaks = filterPeaks(peaks, corr2, THRESHOLD_FRAC);
    for (let j = 1; j < peaks.length; j++) {
      const k = peaks[j];
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(
        map(k, 0, BIN_COUNT, 0, ctx.canvas.width),
        map(corr[k], -1, 1, ctx.canvas.height, 0),
        5,
        0,
        2 * Math.PI,
      );
      ctx.fill();
    }
    const period = extractPeriod(peaks);
    if (period > 0) {
      const baseFreq = sampleRate / period;
      const note = getNoteString(baseFreq, true);
      ctx.fillStyle = getNoteColor(note.slice(0, 2) as TNote);
      ctx.font = "15px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Note: ${note}`, 0, 0);
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
          isActive = true;
          startAnimationLoop(draw);
        });
    },
    stop: () => {
      isActive = false;
      canvas?.remove();
    },
  };
}
