import { describe, expect, test } from "bun:test";

import { formatMoney, parseMoney } from "../src/index.ts";

describe("formatMoney", () => {
  test("groups thousands and puts the euro sign last", () => {
    expect(formatMoney(191_816)).toBe("1,918.16€");
    expect(formatMoney(-5240)).toBe("-52.40€");
    expect(formatMoney(325_000, { sign: true })).toBe("+3,250.00€");
  });
});

describe("parseMoney", () => {
  test("reads common ways of typing an amount", () => {
    expect(parseMoney("12,50")).toBe(1250);
    expect(parseMoney("1,918.16")).toBe(191_816);
    expect(parseMoney("1.918,16 €")).toBe(191_816);
    expect(parseMoney("-42")).toBe(-4200);
    expect(parseMoney("abc")).toBeNull();
  });
});
