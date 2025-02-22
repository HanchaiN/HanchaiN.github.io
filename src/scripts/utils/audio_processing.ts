import convert_color from "@/scripts/utils/color/conversion.js";
import { getChroma, getLightness } from "@/scripts/utils/color/palette.js";

const okhcl2hex = convert_color("okhcl", "hex")!;

export type TNote =
  | "C "
  | "C#"
  | "D "
  | "D#"
  | "E "
  | "F "
  | "F#"
  | "G "
  | "G#"
  | "A "
  | "A#"
  | "B ";

export function getNoteString(freq: number, cent: boolean = false) {
  const NOTE_ORDER: TNote[] = [
    "C ",
    "C#",
    "D ",
    "D#",
    "E ",
    "F ",
    "F#",
    "G ",
    "G#",
    "A ",
    "A#",
    "B ",
  ];
  const noteIndex = Math.round(12 * Math.log2(freq / 440) + 69);
  const noteName = NOTE_ORDER[noteIndex % 12];
  const octave = Math.floor(noteIndex / 12) - 2;
  if (!cent) return `${noteName}${octave}`;
  const expectedFreq = 440 * Math.pow(2, (noteIndex - 69) / 12);
  const errorCent = 1200 * Math.log2(freq / expectedFreq);
  const centString =
    (errorCent >= 0 ? "+" : "-") +
    (Math.abs(errorCent) < 10 ? "0" : "") +
    Math.abs(errorCent).toFixed(2);
  return `${noteName}${octave} ${centString}`;
}

export function getNoteColor(note: TNote) {
  const NOTE_ORDER: TNote[] = [
    "C ",
    "G ",
    "D ",
    "A ",
    "E ",
    "B ",
    "F#",
    "C#",
    "G#",
    "D#",
    "A#",
    "F ",
  ];
  const noteIndex = NOTE_ORDER.indexOf(note);
  const noteColors = okhcl2hex([
    noteIndex / NOTE_ORDER.length,
    getChroma(),
    getLightness(),
  ]);
  return noteColors;
}
