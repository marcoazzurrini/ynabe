import { strFromU8, unzipSync } from "fflate";

/** One spreadsheet row: its cells by column letter. Empty cells are absent. */
export type SheetRow = Partial<Record<string, string | number>>;

const SHEET = "xl/worksheets/sheet1.xml";
const STRINGS = "xl/sharedStrings.xml";

const ENTITIES = new Map([
  ["amp", "&"],
  ["apos", "'"],
  ["gt", ">"],
  ["lt", "<"],
  ["quot", '"'],
]);

const unescape = (xml: string) =>
  xml.replaceAll(/&(?:#(?<code>\d+)|(?<name>[a-z]+));/gu, (whole, code, name) =>
    code ? String.fromCodePoint(Number(code)) : (ENTITIES.get(name) ?? whole)
  );

/** The text of every `<t>` inside a piece of XML, joined. */
const textOf = (xml: string) =>
  unescape(
    [...xml.matchAll(/<t\b[^>]*>(?<text>[^<]*)<\/t>/gu)]
      .map((match) => match.groups?.text ?? "")
      .join("")
  );

/**
 * Reads the first sheet of an .xlsx file. Dates come back as the day
 * numbers Excel stores; `excelDate` turns one into `YYYY-MM-DD`.
 */
export const readSheet = (file: Uint8Array): SheetRow[] => {
  const files = unzipSync(file, {
    filter: ({ name }) => name === SHEET || name === STRINGS,
  });

  const sheet = files[SHEET];

  if (!sheet) {
    throw new Error("The file is not an .xlsx spreadsheet with a first sheet");
  }

  const strings = [
    ...strFromU8(files[STRINGS] ?? new Uint8Array()).matchAll(
      /<si\b[^>]*>(?<item>[\s\S]*?)<\/si>/gu
    ),
  ].map((match) => textOf(match.groups?.item ?? ""));

  return [
    ...strFromU8(sheet).matchAll(/<row\b[^>]*>(?<cells>[\s\S]*?)<\/row>/gu),
  ].map((row) => {
    const cells: SheetRow = {};

    for (const cell of (row.groups?.cells ?? "").matchAll(
      /<c\b(?<attributes>[^>]*?)(?:\/>|>(?<body>[\s\S]*?)<\/c>)/gu
    )) {
      const { attributes = "", body = "" } = cell.groups ?? {};

      const column = /\br="(?<column>[A-Z]+)\d+"/u.exec(attributes)?.groups
        ?.column;

      const type = /\bt="(?<type>\w+)"/u.exec(attributes)?.groups?.type;
      const value = /<v>(?<value>[^<]*)<\/v>/u.exec(body)?.groups?.value;

      if (column && type === "inlineStr") {
        cells[column] = textOf(body);
      } else if (column && value !== undefined) {
        cells[column] =
          type === "s" ? (strings[Number(value)] ?? "") : Number(value);
      }
    }

    return cells;
  });
};

/** Excel counts days from 30 December 1899. */
export const excelDate = (day: number): string =>
  new Date(Date.UTC(1899, 11, 30) + Math.floor(day) * 86_400_000)
    .toISOString()
    .slice(0, 10);
