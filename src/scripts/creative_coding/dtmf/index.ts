export default function execute() {
  const oscl_freq = [697, 770, 852, 941];
  const osch_freq = [1209, 1336, 1477, 1633];
  const keypad = [
    ["1", "2", "3", "a"],
    ["4", "5", "6", "b"],
    ["7", "8", "9", "c"],
    ["*", "0", "#", "d"],
  ];
  let audioContext: AudioContext,
    gainNode: GainNode,
    oscl: OscillatorNode,
    osch: OscillatorNode;
  return {
    start: () => {
      window.addEventListener("keypress", (e) => {
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
          indh = 0;
        for (indl = 0; indl < keypad.length; indl++) {
          for (indh = 0; indh < keypad[indl].length; indh++) {
            if (e.key === keypad[indl][indh]) {
              break;
            }
          }
          if (indh < keypad[indl].length) {
            break;
          }
        }
        if (indl < keypad.length) {
          oscl.frequency.value = oscl_freq[indl];
          osch.frequency.value = osch_freq[indh];
          gainNode.gain.cancelScheduledValues(audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.1);
        }
      });
    },
    stop: () => {
      gainNode?.disconnect();
      audioContext?.close();
    },
  };
}
