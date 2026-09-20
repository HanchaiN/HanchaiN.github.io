export async function workerLoader(workerUrl: string) {
  const importMap = document.querySelector<HTMLScriptElement>('script[type=importmap]')?.innerText ?? '{}';
  return new Promise<Worker>((resolve, reject) => {
    const worker = new Worker(new URL('./workerloader.js', import.meta.url), { type: 'module' });
    function errorListener(this: Worker) {
      this.terminate();
      reject('Error initializing workerloader');
    }
    
    worker.addEventListener('error', errorListener);
    worker.addEventListener('message', function listener() {
      worker.removeEventListener('message', listener);
      worker.removeEventListener('error', errorListener)
      resolve(this);
    });
    worker.postMessage({ importMap, workerUrl });
  });
}

export class WorkerWrapper<MessageRequest, MessageResponse> {
  private _url: string;
  private _worker: Worker | null;
  private _lock: boolean;
  private _fallback: ((d: MessageRequest) => MessageResponse) | null;
  private _promise: Promise<MessageResponse> | null;
  constructor(url: string | URL) {
    this._url = url.toString();
    this._worker = null;
    this._lock = false;
    this._fallback = null;
    this._promise = null;
  }

  async initialize(wait: boolean = false) {
    if (this._worker !== null) return this;
    await new Promise<void>(async (resolve: () => void) => {
      this._worker = await workerLoader(this._url);
      this._worker.addEventListener('error', async () => {
        console.error('Error initializing worker');
        this._lock = true;
        this.terminate();
        // FIXME: Cannot handle stateful worker well
        const module = await import(this._url);
        this._fallback = module.createMain?.() ?? module.main ?? null;
        resolve();
      });
      if (!wait) return resolve();
      this._lock = true;
      this._worker.addEventListener('message', function listener() {
        this.removeEventListener("message", listener);
        resolve();
      });
    });
    this._lock = false;
    return this;
  }

  async execute(request: MessageRequest): Promise<MessageResponse> {
    if (this._fallback) return this._fallback(request);
    if (this._worker === null) throw new Error('Not initialized');
    if (this._lock) throw new Error('Occupied');
    const res = await new Promise<MessageResponse>((resolve: (res: MessageResponse) => void) => {
      this._lock = true;
      this._worker?.addEventListener('message', function listener({ data }) {
        this.removeEventListener('message', listener);
        resolve(data);
      });
      this._worker?.postMessage(request);
    });
    this._lock = false;
    return res;
  }

  push(request: MessageRequest): void {
    this._promise = this.execute(request);
  }
  async wait(): Promise<MessageResponse> {
    if (this._promise === null) throw new Error('Empty');
    const res = await this._promise;
    return res;
  }

  terminate() {
    this._worker?.terminate();
    this._worker = null;
  }
}
export const maxWorkers = window?.navigator?.hardwareConcurrency
  ? Math.floor(window.navigator.hardwareConcurrency)
  : 1;

