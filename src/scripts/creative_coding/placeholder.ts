export default function execute() {
  let element: HTMLElement;
  let canvas: HTMLCanvasElement;
  return {
    start: (node: HTMLElement) => {
      element = node;
      canvas = document.createElement("canvas");
      canvas.id = "canvas";
      const width = (canvas.width = 500);
      const height = (canvas.height = 500);
      canvas.classList.add("border");
      canvas.classList.add("border-primary");
      canvas.classList.add("rounded");
      canvas.classList.add("border-opacity-50");
      node.replaceWith(canvas);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "white";
      ctx.font = "30px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Hello, World!", width / 2, height / 2);
    },
    stop: () => {
      canvas.replaceWith(element);
    },
  };
}
