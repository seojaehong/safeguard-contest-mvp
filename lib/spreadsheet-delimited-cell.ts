export type SpreadsheetDelimiter = "," | "\t";

export function neutralizeSpreadsheetFormula(value: string | number): string {
  const raw = String(value);
  const firstNonFormattingSpace = raw.replace(/^[^\S\r\n\t]*/, "");
  const formulaAfterWhitespace = /^[=+\-@]/u.test(raw.trimStart());
  const controlPrefix = /^[\t\r]/u.test(firstNonFormattingSpace);
  return formulaAfterWhitespace || controlPrefix ? `'${raw}` : raw;
}

export function encodeSpreadsheetDelimitedCell(
  value: string | number,
  delimiter: SpreadsheetDelimiter
): string {
  const neutralized = neutralizeSpreadsheetFormula(value);
  if (delimiter === "\t") {
    return neutralized.replace(/\t/gu, " ").replace(/\r?\n/gu, " ");
  }
  if (!/[",\n\r]/u.test(neutralized)) return neutralized;
  return `"${neutralized.replace(/"/gu, "\"\"")}"`;
}
