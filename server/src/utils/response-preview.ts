/**
 * Construye una vista legible de lo que respondio una fuente, para cuando no
 * se pudo interpretar como filas (tipicamente un 'dataPath' mal puesto).
 *
 * Objetivo: que el usuario vea TODAS las columnas disponibles y la ruta donde
 * viven las filas. Por eso:
 *  - Los objetos se muestran con todos sus campos (son las columnas: no se
 *    recortan, aunque sean decenas).
 *  - Los arreglos de objetos se colapsan a un solo registro representativo que
 *    reune las claves de una muestra (algunas filas omiten campos nulos, asi
 *    que mirar solo la primera perderia columnas); el resto de filas se anota
 *    como "misma estructura", porque repetir filas identicas no aporta.
 */

const MAX_STRING = 80;
const MAX_OUTPUT = 12_000;
const UNION_SAMPLE = 20;

/** Valor abreviado para strings largos; el resto se deja igual. */
function short(value: unknown): unknown {
  if (typeof value === "string" && value.length > MAX_STRING) {
    return `${value.slice(0, MAX_STRING)}…`;
  }
  return value;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Registro representativo de un arreglo de objetos: reune las claves de los
 * primeros UNION_SAMPLE elementos (en orden de aparicion) y toma el primer
 * valor no nulo encontrado para cada una. Asi se ven todas las columnas aunque
 * algunas filas las omitan.
 */
function unionRecord(arr: Record<string, unknown>[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of arr.slice(0, UNION_SAMPLE)) {
    for (const [k, v] of Object.entries(row)) {
      if (!(k in out) || out[k] === null || out[k] === undefined) {
        out[k] = v;
      }
    }
  }
  return out;
}

function compact(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const rest = value.length - 1;

    // Arreglo de objetos = filas: un representante con todas las columnas.
    if (value.every(isPlainObject)) {
      const rep = compact(unionRecord(value as Record<string, unknown>[]));
      return rest > 0
        ? [rep, `… +${rest} fila(s) mas (misma estructura)`]
        : [rep];
    }

    // Arreglo de valores simples: primero + conteo.
    const first = compact(value[0]);
    return rest > 0 ? [first, `… +${rest} elemento(s) mas`] : [first];
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = compact(v);
    return out;
  }

  return short(value);
}

/** Indenta XML que viene en una sola linea, para poder leer su estructura. */
function formatXml(xml: string): string {
  const withBreaks = xml.replace(/>\s*</g, ">\n<");
  let depth = 0;
  return withBreaks
    .split("\n")
    .map((line) => {
      const l = line.trim();
      if (/^<\/[^>]+>/.test(l)) depth = Math.max(0, depth - 1);
      const indented = "  ".repeat(depth) + l;
      // Abre nivel solo si no es auto-cerrado, declaracion, ni cierra en la misma linea
      if (
        /^<[^/!?][^>]*[^/]>$/.test(l) &&
        !new RegExp(`</${l.match(/^<([\w:.-]+)/)?.[1]}>$`).test(l)
      ) {
        depth++;
      }
      return indented;
    })
    .join("\n");
}

export function buildResponsePreview(data: unknown): {
  preview: string;
  format: "json" | "xml" | "text";
} {
  if (typeof data === "string") {
    const trimmed = data.trim();
    const isXml = trimmed.startsWith("<");
    return {
      preview: (isXml ? formatXml(trimmed) : trimmed).slice(0, MAX_OUTPUT),
      format: isXml ? "xml" : "text",
    };
  }

  return {
    preview: JSON.stringify(compact(data), null, 2).slice(0, MAX_OUTPUT),
    format: "json",
  };
}
