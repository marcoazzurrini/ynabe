const QUOTE = '"';

/** Splits CSV text into rows of fields, honouring quotes and line breaks. */
const rowsOf = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endRow = () => {
    row.push(field);
    field = "";

    // A blank line is not a row.
    if (row.length > 1 || row[0] !== "") {
      rows.push(row);
    }

    row = [];
  };

  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];

    if (quoted) {
      if (char !== QUOTE) {
        field += char;
      } else if (text[at + 1] === QUOTE) {
        field += QUOTE;
        at += 1;
      } else {
        quoted = false;
      }
    } else if (char === QUOTE) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      endRow();
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    endRow();
  }

  return rows;
};

/** Reads CSV text with a header row into one record per line. */
export const parseCsv = (text: string): Record<string, string>[] => {
  const [header, ...rows] = rowsOf(text.replace(/^﻿/u, ""));

  if (!header) {
    return [];
  }

  return rows.map((row) =>
    Object.fromEntries(header.map((name, index) => [name, row[index] ?? ""]))
  );
};
