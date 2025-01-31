export function slugify(txt: string) {
  return txt.replaceAll(" ", "_").toLowerCase();
}
export function unslugify(txt: string) {
  return txt.replaceAll("_", " ");
}
