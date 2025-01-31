export function GrayToBinary(num: number) {
  let mask = num;
  while (mask) {
    mask >>= 1;
    num ^= mask;
  }
  return num;
}
export function BinaryToGray(num: number) {
  return num ^ (num >> 1);
}
