export type ExcludeKeys<T, K> = Pick<T, Exclude<keyof T, K>>;
