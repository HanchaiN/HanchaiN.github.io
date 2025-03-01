export function getImageFromInput(input: HTMLInputElement) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (!input.files?.length) return reject("No file selected");
    if (!input.files?.length) return;
    const img = new Image();
    img.addEventListener("load", function onImageLoad() {
      this.removeEventListener("load", onImageLoad);
      resolve(img);
    });
    img.addEventListener("error", function onImageError(ev) {
      this.removeEventListener("error", onImageError);
      reject(ev.error);
    });
    img.src = URL.createObjectURL(input.files[0]);
  });
}
export function getImageData(
  img: HTMLImageElement,
  _canvas: HTMLCanvasElement | null = null,
) {
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    _canvas ?? new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D =
    canvas.getContext("2d")! as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height, {
    colorSpace: "srgb",
  });
}

export function onImageChange(
  input: HTMLInputElement,
  callback: (img: HTMLImageElement) => void,
) {
  input.addEventListener("change", function () {
    if (!this.files?.length) return;
    getImageFromInput(this).then(callback);
  });
}
