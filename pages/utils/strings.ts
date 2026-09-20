/**
 * Convert text to slug format (lowercase with underscores)
 * @param txt - Text to slugify
 * @returns Slugified text
 */
export function slugify(txt: string) {
  return txt.replace(/ /g, "_").toLowerCase();
}

/**
 * Convert slug format back to normal text (spaces instead of underscores)
 * @param txt - Slugified text
 * @returns Normal text with spaces
 */
export function unslugify(txt: string) {
  return txt.replace(/_/g, " ");
}

/**
 * Capitalize first letter of a string
 * @param str - String to capitalize
 * @returns String with first letter capitalized
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to title case (capitalize first letter of each word)
 * @param str - String to convert
 * @returns Title-cased string
 */
export function titleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => capitalize(word))
    .join(" ");
}

/**
 * Truncate string to specified length with ellipsis
 * @param str - String to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated string
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Pad string to specified length
 * @param str - String to pad
 * @param length - Target length
 * @param char - Character to pad with (default: space)
 * @param side - Which side to pad ('start' or 'end', default: 'end')
 * @returns Padded string
 */
export function pad(
  str: string,
  length: number,
  char: string = " ",
  side: "start" | "end" = "end",
): string {
  const padLength = Math.max(0, length - str.length);
  const padding = char.repeat(padLength);
  return side === "start" ? padding + str : str + padding;
}
