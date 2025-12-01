type Timeout = ReturnType<typeof setTimeout>;

/**
 * Creates a debounced function that delays invoking func until after delay milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * @param func - The function to debounce
 * @param delay - The number of milliseconds to delay (default: 1000)
 * @returns The debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number = 1000,
): (...args: Parameters<T>) => void {
  let timer: Timeout | null = null;
  return function (...args: Parameters<typeof func>) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      func(...args);
      timer = null;
    }, delay);
  };
}

/**
 * Creates a throttled function that only invokes func at most once per delay milliseconds.
 * @param func - The function to throttle
 * @param delay - The number of milliseconds to throttle (default: 1000)
 * @returns The throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number = 1000,
): (...args: Parameters<T>) => void {
  let timer: Timeout | null = null;
  let lastRan: number | null = null;
  return function (...args: Parameters<typeof func>) {
    if (lastRan === null) {
      func(...args);
      lastRan = Date.now();
    } else {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(
        () => {
          if (Date.now() - lastRan! >= delay) {
            func(...args);
            lastRan = Date.now();
          }
        },
        delay - (Date.now() - lastRan),
      );
    }
  };
}

/**
 * Iterates through a generator until completion and returns the final value
 * @param gen - The generator to iterate
 * @returns The final value returned by the generator
 */
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
/**
 * Executes a function with try-catch error handling
 * @param fn - Function to execute
 * @param fallback - Fallback value if function throws
 * @param handler - Optional error handler function
 * @returns Result of fn or fallback value
 */
export function try_catch<T>(
  fn: () => T,
  fallback: T | null = null,
  handler: ((e: Error) => T | void) | null = null,
): T {
  try {
    return fn();
  } catch (e) {
    const handlerResult = handler?.(e as Error);
    if (handlerResult !== undefined) return handlerResult as T;
    return fallback as T;
  }
}

/**
 * Creates a memoized version of a function that caches results based on arguments
 * @param fn - The function to memoize
 * @param keyFn - Optional custom key generation function (defaults to JSON.stringify)
 * @returns Memoized version of the function
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string,
): T {
  const cache = new Map<string, ReturnType<T>>();
  const defaultKeyFn = (...args: Parameters<T>) => JSON.stringify(args);
  const getKey = keyFn || defaultKeyFn;

  return ((...args: Parameters<T>) => {
    const key = getKey(...args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Creates a function that is only called once; subsequent calls return the cached result
 * @param fn - The function to call once
 * @returns Function that only executes once
 */
export function once<T extends (...args: unknown[]) => unknown>(fn: T): T {
  let called = false;
  let result: ReturnType<T>;

  return ((...args: Parameters<T>) => {
    if (!called) {
      result = fn(...args) as ReturnType<T>;
      called = true;
    }
    return result;
  }) as T;
}

/**
 * Groups array elements by a key function
 * @param array - Array to group
 * @param keyFn - Function that returns the group key for each element
 * @returns Object with keys as group names and values as arrays of elements
 */
export function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string,
): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    },
    {} as Record<string, T[]>,
  );
}

/**
 * Chunks array into smaller arrays of specified size
 * @param array - Array to chunk
 * @param size - Size of each chunk
 * @returns Array of chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Creates an array of unique values from all given arrays
 * @param arrays - Arrays to union
 * @returns Array of unique values
 */
export function union<T>(...arrays: T[][]): T[] {
  return Array.from(new Set(arrays.flat()));
}

/**
 * Creates an array of values present in all given arrays
 * @param arrays - Arrays to intersect
 * @returns Array of common values
 */
export function intersection<T>(...arrays: T[][]): T[] {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0];

  const firstSet = new Set(arrays[0]);
  return arrays.slice(1).reduce((result, array) => {
    return result.filter((item) => array.includes(item));
  }, Array.from(firstSet));
}

/**
 * Creates an array of values from first array not present in other arrays
 * @param array - Source array
 * @param others - Arrays to exclude
 * @returns Array of values only in first array
 */
export function difference<T>(array: T[], ...others: T[][]): T[] {
  const excludeSet = new Set(others.flat());
  return array.filter((item) => !excludeSet.has(item));
}

/**
 * Removes duplicate values from an array
 * @param array - Array to deduplicate
 * @returns Array with unique values
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Flattens nested arrays to specified depth
 * @param array - Array to flatten
 * @param depth - Maximum depth to flatten (default: 1)
 * @returns Flattened array
 */
export function flatten<T>(array: unknown[], depth: number = 1): T[] {
  if (depth <= 0) return array as T[];
  return array.reduce((acc: unknown[], val) => {
    return acc.concat(Array.isArray(val) ? flatten(val, depth - 1) : val);
  }, []) as T[];
}

/**
 * Combines multiple arrays element-wise into tuples
 * @param arrays - Arrays to zip together
 * @returns Array of tuples
 */
export function zip<T>(...arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  const minLength = Math.min(...arrays.map((arr) => arr.length));
  return Array.from({ length: minLength }, (_, i) =>
    arrays.map((arr) => arr[i]),
  );
}

/**
 * Safely parse integer with fallback
 * @param value - String to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed integer or fallback
 */
export function safeParseInt(value: string, fallback: number = 0): number {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely parse float with fallback
 * @param value - String to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed float or fallback
 */
export function safeParseFloat(value: string, fallback: number = 0): number {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Check if value is a valid number
 * @param value - Value to check
 * @returns True if value is a finite number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Creates a shallow copy of an object, picking only specified keys
 * @param obj - Source object
 * @param keys - Keys to pick
 * @returns New object with only picked keys
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Creates a shallow copy of an object, omitting specified keys
 * @param obj - Source object
 * @param keys - Keys to omit
 * @returns New object without omitted keys
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}
