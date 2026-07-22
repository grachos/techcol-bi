import { describe, expect, it } from 'vitest'
import { monthIndexEs } from './functions'

describe('monthIndexEs', () => {
  it('reconoce nombres completos y abreviados sin importar mayusculas', () => {
    expect(monthIndexEs('enero')).toBe(0)
    expect(monthIndexEs('Enero')).toBe(0)
    expect(monthIndexEs('DICIEMBRE')).toBe(11)
    expect(monthIndexEs('ene')).toBe(0)
    expect(monthIndexEs('Dic')).toBe(11)
    expect(monthIndexEs('sep.')).toBe(8) // con punto final
    expect(monthIndexEs('  Marzo  ')).toBe(2)
  })

  it('devuelve -1 para lo que no es un mes', () => {
    expect(monthIndexEs('')).toBe(-1)
    expect(monthIndexEs('TERCEROS')).toBe(-1)
    expect(monthIndexEs('2024')).toBe(-1)
  })

  it('ordena cronologicamente el eje que antes salia alfabetico', () => {
    // Caso real del bug: el eje mostraba Abril, Agosto, Diciembre, Enero...
    const alfabetico = [
      'Abril', 'Agosto', 'Diciembre', 'Enero', 'Febrero', 'Julio',
      'Junio', 'Marzo', 'Mayo', 'Noviembre', 'Septiembre',
    ]
    const ordenado = [...alfabetico].sort((a, b) => monthIndexEs(a) - monthIndexEs(b))
    expect(ordenado).toEqual([
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Noviembre', 'Diciembre',
    ])
  })
})
