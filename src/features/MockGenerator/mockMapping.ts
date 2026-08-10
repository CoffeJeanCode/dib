import type { ColumnInfo } from "@/types/db";

/**
 * Guesses a faker type from a column, so opening the generator on a normal
 * table already has most rows filled and the user only reviews.
 *
 * Ordered: first match wins, so specific patterns come before generic ones.
 * Both English and Spanish names are matched — the schemas in this app are
 * routinely one or the other.
 */
const NAME_RULES: Array<[RegExp, string]> = [
  [/uuid|guid/, "uuid"],
  [/first_?name|nombre_?pila/, "first_name"],
  [/last_?name|surname|apellido/, "last_name"],
  [/full_?name|^name$|^nombre$/, "full_name"],
  [/e?_?mail|correo/, "email"],
  [/user_?name|login|usuario/, "username"],
  [/phone|mobile|tel|movil|celular/, "phone"],
  [/street|address|direccion|calle/, "street"],
  [/city|ciudad|localidad/, "city"],
  [/country|pais/, "country"],
  [/zip|postal/, "zip"],
  [/company|empresa|organiz/, "company"],
  [/desc|comment|note|body|bio|resumen|observacion/, "sentence"],
  [/title|label|tag|word|titulo|etiqueta/, "word"],
];

function fromDataType(dataType: string): string {
  const t = dataType.toLowerCase();
  if (/bool/.test(t)) return "boolean";
  if (/uuid/.test(t)) return "uuid";
  if (/int|serial|numeric|decimal|real|double|float|money/.test(t)) return "number";
  if (/char|text|string|clob/.test(t)) return "word";
  return "";
}

export function guessFaker(col: ColumnInfo): string {
  // An integer primary key is almost always auto-increment; writing explicit
  // values into it desynchronises the sequence, so leave it to the database.
  const type = (col.data_type || "").toLowerCase();
  if (col.is_primary_key && /int|serial/.test(type)) return "";

  const name = col.name.toLowerCase();
  for (const [pattern, faker] of NAME_RULES) {
    if (pattern.test(name)) return faker;
  }
  return fromDataType(type);
}

export function guessAll(columns: ColumnInfo[]): Record<string, string> {
  return Object.fromEntries(columns.map((c) => [c.name, guessFaker(c)]));
}
