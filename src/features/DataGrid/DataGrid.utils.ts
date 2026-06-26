import type { FilterOperator } from "@/types/db";

export function operatorsForType(dataType?: string): FilterOperator[] {
  if (!dataType) return ["=", "!=", "ILIKE", "NOT ILIKE", "IS NULL", "IS NOT NULL"];
  const t = dataType.toUpperCase();
  if (/INT|FLOAT|NUMERIC|DECIMAL|REAL|DOUBLE|SERIAL|NUMBER/.test(t))
    return ["=", "!=", ">", ">=", "<", "<=", "IS NULL", "IS NOT NULL"];
  if (/DATE|TIME|TIMESTAMP/.test(t))
    return ["=", "!=", ">", ">=", "<", "<=", "IS NULL", "IS NOT NULL"];
  return ["=", "!=", "ILIKE", "NOT ILIKE", "IS NULL", "IS NOT NULL"];
}

export function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function makeKey(pkStr: string, col: string): string {
  return `${pkStr}::${col}`;
}

export function cellId(row: number, col: number): string {
  return `${row}:${col}`;
}

export function buildRangeSet(r1: number, c1: number, r2: number, c2: number): Set<string> {
  const s = new Set<string>();
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
      s.add(cellId(r, c));
  return s;
}
