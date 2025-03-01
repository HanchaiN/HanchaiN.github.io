import { throttle } from "@/scripts/utils/utils.js";
import convert_color from "@/scripts/utils/color/conversion.js";

const str2hex = convert_color("str", "hex")!;

export class PaletteInput {
  private inputContainer: HTMLElement;
  private textInput: HTMLTextAreaElement;
  private listeners: ((palette: string[]) => void)[] = [];
  private _textListener: () => void;
  private palette_: string[] = [];

  constructor(inputContainer: HTMLElement, textInput: HTMLTextAreaElement) {
    this.inputContainer = inputContainer;
    this.textInput = textInput;
    this._textListener = throttle(() => PaletteInput.setFromText(this), 1000);
    this.textInput.addEventListener("change", this._textListener);
    this.listeners = [];
    this.palette_ = [];
  }

  get value() {
    return this.palette_;
  }

  set value(palette: string[]) {
    this.palette_ = palette.map((x) => str2hex(x));
    this.textInput.value = "";
    this.inputContainer.innerHTML = "";
    palette.forEach((color, i) => {
      const input = document.createElement("input");
      input.type = "color";
      input.value = str2hex(color);
      this.inputContainer.appendChild(input);
      input.addEventListener("change", () => {
        this.palette_[i] = str2hex(input.value);
        this.value = this.palette_;
      });
      this.textInput.value += input.value + "\n";
    });
    this.listeners.forEach((x) => x(this.palette_));
  }

  private static setFromText(paletteInput: PaletteInput) {
    paletteInput.value = paletteInput.textInput.value
      .split("\n")
      .filter((x) => x.trim())
      .map((x) => str2hex(x));
  }

  addChangeHandler(callback: (palette: string[]) => void) {
    this.listeners.push(callback);
  }

  removeChangeHandler(callback: (palette: string[]) => void) {
    this.listeners = this.listeners.filter((x) => x !== callback);
  }
}
