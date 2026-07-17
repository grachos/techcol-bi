/**
 * Construye una vista legible de lo que respondio una fuente, para cuando no
 * se pudo interpretar como filas (tipicamente un 'dataPath' mal puesto).
 *
 * El objetivo es que el usuario reconozca la FORMA de la respuesta y deduzca
 * la ruta correcta, no ver el volcado completo: se recorta cada arreglo a su
 * primer elemento y cada registro a unos pocos campos, anotando lo omitido.
 */

const MAX_FIELDS = 8;
const MAX_STRING = 80;
const MAX_OUTPUT = 4000;

function compact(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const rest = value.length - 1;
    const first = compact(value[0], depth + 1);
    return rest > 0 ? [first, `… +${rest} elemento(s) mas`] : [first];
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    const shown = entries.slice(0, MAX_FIELDS);
    const out: Record<string, unknown> = {};
    for (const [k, v] of shown) out[k] = compact(v, depth + 1);
    if (entries.length > MAX_FIELDS) {
      out[`… +${entries.length - MAX_FIELDS} campo(s) mas`] = "";
    }
    return out;
  }

  return value;
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
