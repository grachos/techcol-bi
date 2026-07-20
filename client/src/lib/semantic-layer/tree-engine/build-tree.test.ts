import { describe, expect, it } from 'vitest'
import { buildAggregationTree } from './build-tree'
import { MeasureRegistry } from './measure-registry'
import type { AggregationNode } from './types'

function findChild(node: AggregationNode, dimension: string, value: unknown): AggregationNode {
  const child = node.children.find((c) => c.dimensionValues[dimension] === value)
  if (!child) throw new Error(`No se encontro hijo ${dimension}=${value}`)
  return child
}

describe('buildAggregationTree', () => {
  // Reproduce exactamente el caso reportado: un manifiesto trae varias
  // remesas (por eso el manifiesto se repite), cada remesa con su propia
  // tarifa, pero el flete del manifiesto es el mismo valor repetido en cada
  // fila. Margen = SUM(remesa) - MIN(flete) es correcto a nivel manifiesto,
  // pero sumar filas de varios manifiestos y recalcular ahi mismo el MIN
  // colapsa el flete a un solo valor global -- el bug original.
  const rows = [
    { cliente: 'SUPPLA', manifiesto: '101', remesa: 500_000, flete: 1_054_000 },
    { cliente: 'SUPPLA', manifiesto: '101', remesa: 679_000, flete: 1_054_000 },
    { cliente: 'SUPPLA', manifiesto: '102', remesa: 300_000, flete: 250_000 },
  ]

  function makeRegistry() {
    const registry = new MeasureRegistry()
    registry.register({ kind: 'simple', name: 'remesa_total', label: 'Total Remesa', column: 'remesa', aggregation: 'sum' })
    registry.register({
      kind: 'leaf',
      name: 'margen',
      label: 'Margen',
      expression: 'SUM(remesa) - MIN(flete)',
      combinator: 'sum',
    })
    registry.register({
      kind: 'derived',
      name: 'rentabilidad',
      label: 'Rentabilidad',
      expression: 'margen / remesa_total',
    })
    return registry
  }

  it('calcula Margen correctamente en la hoja (manifiesto)', () => {
    const tree = buildAggregationTree(rows, ['cliente', 'manifiesto'], makeRegistry())
    const cliente = findChild(tree, 'cliente', 'SUPPLA')
    const manifiesto101 = findChild(cliente, 'manifiesto', '101')

    expect(manifiesto101.isLeaf).toBe(true)
    // SUM(remesa) = 500000 + 679000 = 1179000; MIN(flete) = 1054000 (unico valor, repetido)
    expect(manifiesto101.metrics.margen).toBe(1_179_000 - 1_054_000) // 125000
  })

  it('NO recalcula la formula en el nodo padre: suma los margenes ya calculados de los hijos', () => {
    const tree = buildAggregationTree(rows, ['cliente', 'manifiesto'], makeRegistry())
    const cliente = findChild(tree, 'cliente', 'SUPPLA')
    const manifiesto102 = findChild(cliente, 'manifiesto', '102')

    // manifiesto 102: SUM(remesa)=300000, MIN(flete)=250000 -> margen=50000
    expect(manifiesto102.metrics.margen).toBe(50_000)

    // el padre "SUPPLA" debe ser 125000 + 50000 = 175000 (suma de margenes ya
    // calculados), NO SUM(remesa_total_cliente) - MIN(flete_global), que
    // daria 1479000 - 250000 = 1229000 -- el bug original.
    expect(cliente.metrics.margen).toBe(175_000)
    expect(cliente.metrics.margen).not.toBe(1_479_000 - 250_000)
  })

  it('recalcula la metrica derivada (Rentabilidad) en cada nivel usando los valores ya resueltos del nodo', () => {
    const tree = buildAggregationTree(rows, ['cliente', 'manifiesto'], makeRegistry())
    const cliente = findChild(tree, 'cliente', 'SUPPLA')
    const manifiesto101 = findChild(cliente, 'manifiesto', '101')

    expect(manifiesto101.metrics.rentabilidad).toBeCloseTo(125_000 / 1_179_000)
    expect(cliente.metrics.rentabilidad).toBeCloseTo(175_000 / 1_479_000)
    // Cada nivel tiene su propio ratio, no el mismo valor propagado
    expect(cliente.metrics.rentabilidad).not.toBe(manifiesto101.metrics.rentabilidad)
  })

  it('metrica simple (SUM) es distributiva: el padre suma los valores de los hijos', () => {
    const tree = buildAggregationTree(rows, ['cliente', 'manifiesto'], makeRegistry())
    const cliente = findChild(tree, 'cliente', 'SUPPLA')
    expect(cliente.metrics.remesa_total).toBe(500_000 + 679_000 + 300_000)
  })

  it('metrica derived con columnas crudas (sin pasar por otra medida) sigue funcionando en cualquier nivel -- comportamiento historico preservado', () => {
    const registry = new MeasureRegistry()
    // Formula "derived" que agrega columnas crudas directamente, sin
    // registrar una medida "simple" intermedia -- patron usado por metricas
    // creadas antes de este cambio. Debe seguir dando el resultado correcto
    // recalculando sobre las filas de cada nodo, como siempre.
    registry.register({ kind: 'derived', name: 'total_directo', label: 'Total Directo', expression: 'SUM(remesa)' })

    const tree = buildAggregationTree(rows, ['cliente', 'manifiesto'], registry)
    const cliente = findChild(tree, 'cliente', 'SUPPLA')
    const manifiesto101 = findChild(cliente, 'manifiesto', '101')

    expect(manifiesto101.metrics.total_directo).toBe(500_000 + 679_000)
    expect(cliente.metrics.total_directo).toBe(500_000 + 679_000 + 300_000)
  })

  it('sin niveles de agrupacion, el arbol tiene una sola hoja (el total)', () => {
    const tree = buildAggregationTree(rows, [], makeRegistry())
    expect(tree.isLeaf).toBe(true)
    expect(tree.metrics.remesa_total).toBe(1_479_000)
    expect(tree.metrics.margen).toBe(1_479_000 - 250_000) // MIN(flete) global, correcto: es la unica hoja
  })
})

describe('MeasureRegistry - validacion de dependencias por grano', () => {
  it('rechaza una metrica leaf que depende de otra leaf o derived', () => {
    const registry = new MeasureRegistry()
    registry.register({ kind: 'leaf', name: 'margen', label: 'Margen', expression: 'SUM(remesa) - MIN(flete)' })

    expect(() =>
      registry.register({
        kind: 'leaf',
        name: 'margen_doble',
        label: 'Margen Doble',
        expression: 'margen * 2',
      })
    ).toThrow(/solo puede usar medidas "simple"/)
  })

  it('permite que una metrica derived dependa de simple y leaf', () => {
    const registry = new MeasureRegistry()
    registry.register({ kind: 'simple', name: 'remesa_total', label: 'Total Remesa', column: 'remesa', aggregation: 'sum' })
    registry.register({ kind: 'leaf', name: 'margen', label: 'Margen', expression: 'SUM(remesa) - MIN(flete)' })

    expect(() =>
      registry.register({
        kind: 'derived',
        name: 'rentabilidad',
        label: 'Rentabilidad',
        expression: 'margen / remesa_total',
      })
    ).not.toThrow()
  })

  it('detecta referencias circulares entre metricas derived', () => {
    const registry = new MeasureRegistry()
    registry.register({ kind: 'derived', name: 'a', label: 'A', expression: 'b + 1' })

    expect(() =>
      registry.register({ kind: 'derived', name: 'b', label: 'B', expression: 'a + 1' })
    ).toThrow(/circular/)
  })
})
