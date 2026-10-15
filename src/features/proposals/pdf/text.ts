// Standard Helvetica AFM advance widths, in thousandths of an em (ASCII 32-126).
const regular = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];
const bold = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584,
  584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
  278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278,
  556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
  500, 389, 280, 389, 584,
];
const winAnsi: Record<string, number> = {
  "\u20ac": 128,
  "\u201a": 130,
  "\u0192": 131,
  "\u201e": 132,
  "\u2026": 133,
  "\u2020": 134,
  "\u2021": 135,
  "\u02c6": 136,
  "\u2030": 137,
  "\u0160": 138,
  "\u2039": 139,
  "\u0152": 140,
  "\u017d": 142,
  "\u2018": 145,
  "\u2019": 146,
  "\u201c": 147,
  "\u201d": 148,
  "\u2022": 149,
  "\u2013": 150,
  "\u2014": 151,
  "\u02dc": 152,
  "\u2122": 153,
  "\u0161": 154,
  "\u203a": 155,
  "\u0153": 156,
  "\u017e": 158,
  "\u0178": 159,
};

export function normalizePdfText(text: string) {
  return text
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t ]+/gu, " ")
    .trim();
}

export function encodePdfText(text: string) {
  return Array.from(normalizePdfText(text), (character) => {
    const code = character.codePointAt(0) ?? 63;
    // Base fonts support WinAnsi, not Arabic shaping or arbitrary Unicode.
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255))
      return character;
    return winAnsi[character] ? String.fromCharCode(winAnsi[character]) : "?";
  })
    .join("")
    .replace(/[\\()]/gu, (character) => `\\${character}`);
}

export function measurePdfText(
  text: string,
  size: number,
  font: "regular" | "bold" = "regular",
) {
  const widths = font === "bold" ? bold : regular;
  // A full em is a conservative bound for supported non-ASCII glyphs.
  return (
    (Array.from(text).reduce(
      (width, char) => width + (widths[char.charCodeAt(0) - 32] ?? 1000),
      0,
    ) *
      size) /
    1000
  );
}

export function wrapPdfText(
  text: string,
  width: number,
  size: number,
  font: "regular" | "bold" = "regular",
) {
  const lines: string[] = [];
  for (const paragraph of normalizePdfText(text).split(/\n+/u)) {
    let line = "";
    for (const word of paragraph.split(/\s+/u).filter(Boolean)) {
      if (line && measurePdfText(`${line} ${word}`, size, font) <= width) {
        line += ` ${word}`;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      for (const char of word) {
        if (line && measurePdfText(line + char, size, font) > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}
