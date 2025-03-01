import { binarySearch } from "@/scripts/utils/algo/datastructure.js";
import {
  getNoteColor,
  getNoteString,
} from "@/scripts/utils/audio_processing.js";
import type { TNote } from "@/scripts/utils/audio_processing.js";
import {
  constrain,
  constrainMap,
  lerp,
  map,
} from "@/scripts/utils/math/utils.js";

export default function execute() {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let isActive = false;
  let bufferArray: Float32Array;
  let audioCtx: AudioContext;
  let audioSource: MediaStreamAudioSourceNode;
  let analyser: AnalyserNode;
  let gainNode: GainNode;
  let sampleRate: number;
  const MIN_DB = -100,
    MAX_DB = +20;
  const MIN_FREQ = 20,
    MAX_FREQ = 20000;
  const DELTA_FREQ = 20;
  let minDb = MIN_DB,
    maxDb = MAX_DB;

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
    sampleRate = audioSource.mediaStream
      .getAudioTracks()[0]
      .getSettings().sampleRate!;
    gainNode = audioCtx.createGain();
    analyser = audioCtx.createAnalyser();
    audioSource.connect(gainNode);
    gainNode.connect(analyser);
    gainNode.gain.value = 1;
    analyser.fftSize = Math.pow(2, 12);
    const bufferLength = analyser.frequencyBinCount;
    bufferArray = new Float32Array(bufferLength);

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  function draw() {
    if (!isActive) return;
    analyser.getFloatFrequencyData(bufferArray);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const maxDb_ = constrain(
        bufferArray.reduce((a, b) => Math.max(a, b)),
        MIN_DB,
        MAX_DB,
      ),
      minDb_ = constrain(
        bufferArray.reduce((a, b) => Math.min(a, b)),
        MIN_DB,
        MAX_DB,
      );
    maxDb = lerp(maxDb_ > maxDb ? 0.5 : 0.01, maxDb, maxDb_);
    minDb = lerp(minDb_ < minDb ? 0.5 : 0.01, minDb, minDb_);
    const mapDb = (db: number) => constrainMap(db, minDb, maxDb, 0, 1);
    const getFreq = (i: number) =>
      map(i, 0, bufferArray.length - 1, 0, sampleRate / 2);
    const getIndex = (freq: number) =>
      Math.round(map(freq, 0, sampleRate / 2, 0, bufferArray.length - 1));
    const mapFreq = (freq: number) => Math.log(Math.max(1, freq));
    const getX = (freq: number) =>
      constrainMap(
        mapFreq(freq),
        mapFreq(MIN_FREQ),
        mapFreq(MAX_FREQ),
        0,
        ctx.canvas.width,
      );
    const peakIndex: number[] = [];
    for (let i = 0; i < bufferArray.length; i++) {
      ctx.fillStyle = "#888";
      const db = bufferArray[i];
      const value = mapDb(db);
      const freq = getFreq(i);
      if (freq < MIN_FREQ || freq > MAX_FREQ) continue;
      const lInd = getIndex(freq - DELTA_FREQ) - 1,
        hInd = getIndex(freq + DELTA_FREQ) + 1;
      if (
        mapDb(bufferArray[i]) >=
        new Array(hInd - lInd + 1)
          .fill(0)
          .map((_, j) => lInd + j)
          .filter((j) => j >= 0 && j < bufferArray.length)
          .map((j) => mapDb(bufferArray[j]))
          .reduce((a, b) => Math.max(a, b), -Infinity)
      ) {
        ctx.fillStyle = "red";
        peakIndex.push(i);
      }
      const barHeight = value * ctx.canvas.height;
      const x0 = getX(getFreq(i)),
        x1 = getX(getFreq(i + 1));
      ctx.fillRect(
        Math.min(x0, x1),
        ctx.canvas.height - barHeight,
        Math.abs(x1 - x0),
        barHeight,
      );
    }
    const harmonics = new Array(100).fill(0).map((_, k) => k + 1);
    const peakMatch: [number, number][] = [];
    peakIndex.forEach((i, _, _peakIndex) => {
      let score = (bufferArray[i] * harmonics.length) / 20;
      const lFreq = getFreq(i - 1),
        hFreq = getFreq(i + 1);
      for (const k of harmonics) {
        const lTargetFreq = lFreq * k,
          hTargetFreq = hFreq * k;
        const lTargetIndex = getIndex(lTargetFreq) - 1,
          hTargetIndex = getIndex(hTargetFreq) + 1;
        if (binarySearch(_peakIndex, lTargetIndex, hTargetIndex) >= 0) score++;
      }
      peakMatch.push([i, score]);
    });
    const baseIndex = peakMatch.reduce(
      ([i, max], [j, curr]) => (max >= curr ? [i, max] : [j, curr]),
      [-1, -Infinity],
    )[0];
    if (baseIndex >= 0) {
      const baseFreq = getFreq(baseIndex);
      const note = getNoteString(baseFreq, true);
      ctx.fillStyle = getNoteColor(note.slice(0, 2) as TNote);
      for (const k of harmonics) {
        const freq = baseFreq * k;
        ctx.fillRect(getX(freq), 0, 1, ctx.canvas.height);
      }
      ctx.font = "15px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Note: ${note}`, 0, 0);
      {
        const lFreq = getFreq(baseIndex - 1),
          hFreq = getFreq(baseIndex + 1);
        let state = 0;
        ctx.strokeStyle = "white";
        ctx.beginPath();
        for (const k of harmonics) {
          const lTargetFreq = lFreq * k,
            hTargetFreq = hFreq * k;
          const lTargetIndex = getIndex(lTargetFreq) - 1,
            hTargetIndex = getIndex(hTargetFreq) + 1;
          const ind = binarySearch(peakIndex, lTargetIndex, hTargetIndex);
          if (ind < 0) continue;
          const x = getX(getFreq(peakIndex[ind]));
          const y =
            ctx.canvas.height -
            mapDb(bufferArray[peakIndex[ind]]) * ctx.canvas.height;
          if (state === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          state = 1;
        }
        ctx.stroke();
      }
    }
    requestAnimationFrame(draw);
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
          requestAnimationFrame(draw);
        });
    },
    stop: () => {
      isActive = false;
      canvas?.remove();
    },
  };
}
