class ABC {
  static audioContext: AudioContext;
  static  gainNode: GainNode;
  static  osc: OscillatorNode;

  static osc_lookup = new Map(Object.entries({
    'C': 440 * 3 / 5,
    'D': 440 * 2 / 3,
    'E': 440 * 3 / 4,
    'F': 440 * 4 / 5,
    'G': 440 * 9 / 10,
    'A': 440 * 1 / 1,
    'B': 440 * 9 / 8,
    'c': 440 * 6 / 5,
    'd': 440 * 4 / 3,
    'e': 440 * 3 / 2,
    'f': 440 * 8 / 5,
    'g': 440 * 9 / 5,
    'a': 440 * 2 / 1,
    'b': 440 * 9 / 4,
    }));

  private _score: string;
  private _index: number;
  constructor(score: string) {
    this._score = score;
    this._index = 0;
  }
  static setup() {
    if (typeof this.audioContext === "undefined") {
      this.audioContext = new AudioContext();
      this.gainNode = new GainNode(this.audioContext);
      this.osc = new OscillatorNode(this.audioContext, {
        type: "sine",
      });
      this.gainNode.gain.value = 0;
      this.gainNode.connect(this.audioContext.destination);
      this.osc.connect(this.gainNode);
      this.osc.start();
    }
  }
  static async play(ch: string) {
    this.setup();

    if (!this.osc_lookup.has(ch)) return;
    const frequency = this.osc_lookup.get(ch)!;
    const duration = 60 * 1 / 120;
    return new Promise<void>((resolve) => {
      const currentTime = this.audioContext.currentTime;
      setTimeout(() => resolve(), 1000*duration);
      this.osc.frequency.setValueAtTime(frequency, currentTime);
      this.gainNode.gain.cancelScheduledValues(currentTime);
      this.gainNode.gain.setValueAtTime(0.5, currentTime);
      this.gainNode.gain.setValueAtTime(0, currentTime + duration);
    });
  }

  async playNext() {
    const ch = this._score[this._index];
    await ABC.play(ch);
    this._index++;
    return this._index < this._score.length;
  }
  
  async play() {
    while (true) {
      if (!await this.playNext()) return;
    }
  }
}

export default function execute() {
  let manager: ABC
  return {
    start: (sketch: HTMLCanvasElement, config: HTMLFormElement) => {
      config.querySelector("#start")?.addEventListener("click", () => {
        ABC.setup();
        
        const score = config.querySelector<HTMLTextAreaElement>("#score")?.value || "";
        manager = new ABC(score);
        manager.play();
      })
    },
    stop: () => {
      ABC.gainNode?.disconnect();
      ABC.audioContext?.close();
    },
  };
}
