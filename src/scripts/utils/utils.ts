type Timeout = ReturnType<typeof setTimeout>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any) => any>(
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
