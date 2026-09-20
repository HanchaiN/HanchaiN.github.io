export default function execute() {
  const oscl_freq = [697, 770, 852, 941];
  const osch_freq = [1209, 1336, 1477, 1633];
  const keypads: {
    property: "key" | "code";
    keypad: (string | null)[][];
  }[] = [
    // {
    //   property: 'key',
    //   keypad: [
    //     ["1", "2", "3", "a"],
    //     ["4", "5", "6", "b"],
    //     ["7", "8", "9", "c"],
    //     ["*", "0", "#", "d"],
    //   ]
    // },
    {
      property: "code",
      keypad: [
        ["Digit1", "Digit2", "Digit3", "Digit4"],
        ["KeyQ", "KeyW", "KeyE", "KeyR"],
        ["KeyA", "KeyS", "KeyD", "KeyF"],
        ["KeyZ", "KeyX", "KeyC", "KeyV"],
      ],
    },
    {
      property: "code",
      keypad: [
        ["Numpad1", "Numpad2", "Numpad3", null],
        ["Numpad4", "Numpad5", "Numpad6", null],
        ["Numpad7", "Numpad8", "Numpad9", null],
        [null, "Numpad0", "NumpadDecimal", null],
      ],
    },
  ];
  let audioContext: AudioContext,
    gainNode: GainNode,
    oscl: OscillatorNode,
    osch: OscillatorNode;
  return {
    start: () => {
      window.addEventListener("keypress", (e: KeyboardEvent) => {
        if (typeof audioContext === "undefined") {
          audioContext = new AudioContext();
          gainNode = new GainNode(audioContext);
          oscl = new OscillatorNode(audioContext, {
            type: "sine",
          });
          osch = new OscillatorNode(audioContext, {
            type: "sine",
          });
          gainNode.gain.value = 0;
          gainNode.connect(audioContext.destination);
          oscl.connect(gainNode);
          osch.connect(gainNode);
          oscl.start();
          osch.start();
        }

        let indl = 0,
          indh = 0,
          found = false;
        for (let entry of keypads) {
          for (indl = 0; indl < entry.keypad.length; indl++) {
            if (typeof entry.keypad[indl] === "undefined") break;
            for (indh = 0; indh < entry.keypad[indl]!.length; indh++) {
              if (e[entry.property] === entry.keypad[indl]![indh]) {
                found = true;
                break;
              }
            }
            if (found) break;
          }
          if (found) break;
        }
        if (!found) return;
        oscl.frequency.value = oscl_freq[indl] ?? 0;
        osch.frequency.value = osch_freq[indh] ?? 0;
        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.1);
      });
    },
    stop: () => {
      gainNode?.disconnect();
      audioContext?.close();
    },
  };
}
