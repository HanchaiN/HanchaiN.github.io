import { binarySearchBound } from "@/scripts/utils/algo/datastructure.js";
import { map } from "@/scripts/utils/math/utils.js";

export type TSpectrum = number[] & { readonly length: 7 };
export const wavelengths: TSpectrum = [400, 450, 500, 550, 600, 650, 700];

type SpectrumData = {
  header: string[];
  data: number[][];
};
export async function readSpectrum(
  source: string | SpectrumData,
  column: string,
): Promise<TSpectrum> {
  let data: SpectrumData;
  if (typeof source === "string") {
    const res = await fetch(source);
    data = await res.json();
  } else {
    data = source;
  }
  const w_idx = data.header.indexOf("wavelength");
  if (w_idx < 0) throw new Error("No wavelength column found");
  const c_idx = data.header.indexOf(column);
  if (c_idx < 0) throw new Error(`No ${column} column found`);
  const data_: [number, number][] = data.data
    .sort((a, b) => a[w_idx] - b[w_idx])
    .map((row) => [row[w_idx], row[c_idx]]);
  const spec = wavelengths.map((w) => {
    const [il, ih] = binarySearchBound(
      data_.map((d) => d[0]),
      w,
    );
    if (il < 0 || ih > data_.length - 1) {
      console.warn(`Wavelength ${w}nm is out of range`);
      return 0;
    }
    const [wl, dl] = data_[il];
    const [wh, dh] = data_[ih];
    return map(w, wl, wh, dl, dh);
  }) as TSpectrum;
  return spec;
}
