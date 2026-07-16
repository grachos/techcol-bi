/** Abrevia números grandes para ejes/etiquetas de gráficas: 1200 -> "1.2k", 3400000 -> "3.4M" */
export function formatCompactNumber(value: number): string {
  if (!isFinite(value)) return String(value)
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

/** Trunca etiquetas largas del eje X para que no se solapen en widgets pequeños */
export function truncateLabel(value: unknown, maxLen = 10): string {
  const s = String(value)
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s
}
