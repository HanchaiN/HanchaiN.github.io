export const MAX_DEPTH = 3;
export const STEP_SCALE = 1 - Math.pow(1 / 1024, 1 / 5); // 5 steps to 1/1024
// Distance
export const MIN_DIST = 1e-2;
export const MAX_DIST = 1e4;
// Intensity
export const MIN_LUM = 1e-10;
export const MAX_LUM = 100;
// Importance sampling
export const RIG_PROB = 0.5;
export const RIG_THETA = (2 * Math.PI * 1) / 24; // in radians
