import type { Layout } from 'react-grid-layout'

export const GRID_COLS = 12
export const ROW_HEIGHT = 40

/**
 * En movil (<768px) 12 columnas quedan ilegibles: se apilan los widgets en
 * una sola columna a lo ancho, ordenados por su posicion (y, x) del layout
 * de escritorio. El layout guardado no se modifica.
 */
export function stackLayoutForMobile(layout: Layout[]): Layout[] {
  const ordered = [...layout].sort((a, b) => a.y - b.y || a.x - b.x)
  let y = 0
  return ordered.map((l) => {
    const item = { ...l, x: 0, y, w: 1, minW: 1 }
    y += l.h
    return item
  })
}
