type Timeout = ReturnType<typeof setTimeout>;

export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number = 1000,
): (...args: Parameters<T>) => void {
  let timer: Timeout | null = null;
  return function (...args: Parameters<typeof func>) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

export function iterate_all<T>(gen: Generator<unknown, T, unknown>): T {
  let result = gen.next();
  while (!result.done) {
    result = gen.next();
  }
  return result.value;
}

export function try_catch<T>(fn: () => T, fallback: T): T;
export function try_catch<T>(
  fn: () => T,
  fallback: T,
  handler: ((e: Error) => T | void) | null,
): T;
export function try_catch<T>(
  fn: () => T,
  fallback: null,
  handler: (e: Error) => T,
): T;
export function try_catch<T>(
  fn: () => T,
  fallback: T | null = null,
  handler: ((e: Error) => T | void) | null = null,
): T {
  try {
    return fn();
  } catch (e) {
    return handler?.(e as Error) ?? fallback!;
  }
}
