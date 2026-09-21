export async function workerLoader(workerUrl: string) {
  const importMap =
    document.querySelector<HTMLScriptElement>("script[type=importmap]")
      ?.innerText ?? "{}";
  return new Promise<Worker>((resolve, reject) => {
    const worker = new Worker(new URL("./workerloader.js", import.meta.url), {
      type: "module",
    });
    function errorListener(this: Worker) {
      this.terminate();
      reject("Error initializing workerloader");
    }

    worker.addEventListener("error", errorListener);
    worker.addEventListener("message", function listener() {
      worker.removeEventListener("message", listener);
      worker.removeEventListener("error", errorListener);
      resolve(this);
    });
    worker.postMessage({ importMap, workerUrl });
  });
}

abstract class WorkerWrapper<_MessageRequest, MessageResponse> {
  protected _url: string;
  protected _worker: Worker | null;
  protected _lock: boolean;
  constructor(url: string | URL) {
    this._url = url.toString();
    this._worker = null;
    this._lock = false;
  }

  async initialize(wait: boolean = false): Promise<typeof this> {
    if (this._worker !== null) return this;
    return new Promise<typeof this>(async (resolve, reject) => {
      this._worker = await workerLoader(this._url);
      this._worker.addEventListener("error", async () => {
        console.error("Error initializing worker");
        this._lock = true;
        this.terminate();
        return reject();
      });
      if (!wait) {
        this._lock = false;
        return resolve(this);
      }
      this._wait().then((_null) => {
        return resolve(this);
      });
    });
  }

  protected async _wait(): Promise<MessageResponse> {
    if (this._lock) throw new Error("Occupied");
    return new Promise<MessageResponse>((resolve) => {
      this._lock = true;
      const listener = ({ data }: MessageEvent) => {
        this._worker?.removeEventListener("message", listener);
        this._lock = false;
        resolve(data);
      };
      this._worker?.addEventListener("message", listener);
    });
  }
  async wait(): Promise<MessageResponse> {
    return this._wait();
  }

  terminate() {
    this._worker?.terminate();
    this._worker = null;
  }
}
export class TaskWorkerWrapper<
  MessageRequest,
  MessageResponse,
> extends WorkerWrapper<MessageRequest, MessageResponse> {
  private _fallback: ((d: MessageRequest) => MessageResponse) | null;
  private _promise: Promise<MessageResponse> | null;
  constructor(url: string | URL) {
    super(url);
    this._fallback = null;
    this._promise = null;
  }

  override async initialize(wait: boolean = false): Promise<typeof this> {
    return new Promise((resolve, reject) => {
      super
        .initialize(wait)
        .then(resolve)
        .catch(async (_) => {
          const module = await import(this._url).catch(reject);
          this._fallback = module.createMain?.() ?? module.main ?? null;
          if (this._fallback === null) return reject();
          this._lock = false;
          return resolve(this);
        });
    });
  }

  async execute(request: MessageRequest): Promise<MessageResponse> {
    if (this._fallback) {
      this._lock = true;
      const p = this._fallback(request);
      this._lock = false;
      return await p;
    }
    if (this._worker === null) throw new Error("Not initialized");
    const p = this._wait();
    this._worker?.postMessage(request);
    return await p;
  }

  push(request: MessageRequest): void {
    this._promise = this.execute(request);
  }

  override async wait(): Promise<MessageResponse> {
    if (this._promise === null) throw new Error("Empty");
    const res = await this._promise;
    this._promise = null;
    return res;
  }
}

export const maxWorkers = window?.navigator?.hardwareConcurrency
  ? Math.floor(window.navigator.hardwareConcurrency)
  : 1;
