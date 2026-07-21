import { useDeferredValue, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TreeGrid, type TreeGridColumn, type TreeGridGroupLevel } from '@/components/tree-grid'
import type { FilterDefinition } from '@/components/tree-grid/types-filters'
import { useTreeAggregation } from '@/hooks/use-tree-aggregation'
import { type Widget } from '@/lib/dashboard-api'
import { type TreeNodeDTO } from '@/lib/bi-api'
import { type ActiveFilters } from '@/lib/widget-filters'
import { WidgetEmpty, WidgetError, WidgetLoading } from './widget-state'

type Row = Record<string, unknown>

interface TreeGridWidgetProps {
  widget: Widget
  activeFilters: ActiveFilters
}

/**
 * <TreeGrid> arma su propia jerarquia internamente y solo entrega, por
 * columna, las filas hoja de cada grupo visible (`aggregate: (rows) => ...`).
 * El arbol pre-agregado viene del SERVIDOR; para el valor de cada grupo se
 * localiza su nodo por el prefijo de dimensiones donde TODAS las filas del
 * grupo coinciden -- eso identifica exactamente la profundidad y el camino.
 */
function findNodeForRows(root: TreeNodeDTO, rows: Row[], dims: string[]): TreeNodeDTO | null {
  if (rows.length === 0) return null
  let depth = 0
  outer: for (; depth < dims.length; depth++) {
    const dim = dims[depth]
    const first = String(rows[0][dim] ?? '')
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][dim] ?? '') !== first) break outer
    }
  }
  let node = root
  for (let level = 0; level < depth; level++) {
    const value = String(rows[0][dims[level]] ?? '')
    const child = node.children.find((c) => String(c.dimensionValues[dims[level]] ?? '') === value)
    if (!child) return null
    node = child
  }
  return node
}

export function TreeGridWidget({ widget, activeFilters }: TreeGridWidgetProps) {
  const { t } = useTranslation()

  const rawGroupByColumns = useMemo(
    () => (widget.xKey ? widget.xKey.split(',').filter(Boolean) : []),
    [widget.xKey]
  )
  const rawValueColumns = useMemo(
    () => (widget.yKey ? widget.yKey.split(',').filter(Boolean) : []),
    [widget.yKey]
  )

  // Agregacion en el SERVIDOR: el arbol jerarquico (la parte que congelaba el
  // navegador con decenas de miles de filas) se calcula alla y llega listo,
  // junto a las filas hoja proyectadas (solo las columnas necesarias).
  const { data, error, isLoading, needsDateFilter } = useTreeAggregation(
    widget,
    activeFilters,
    rawGroupByColumns,
    rawValueColumns
  )

  // Se usan las columnas VALIDADAS que devolvio el servidor (descarta las que
  // ya no existen), no las crudas del widget.
  const groupByColumns = data?.groupByColumns ?? []
  const valueColumns = data?.valueColumns ?? []
  const leaves = useMemo(() => (data?.leaves ?? []) as Row[], [data])
  const root = data?.root ?? null

  // TreeGrid arma su propia jerarquia de UI (agrupar/ordenar/filtrar/contar,
  // ver use-tree-grid.ts) sobre TODAS las filas hoja recibidas -- con
  // "manifiesto" casi unico, eso son decenas de miles de filas en cada
  // cambio de filtro. Deferir deja el contenido anterior en pantalla mientras
  // React arma la version nueva en segundo plano, en vez de bloquear el hilo
  // y disparar el aviso de "pagina no responde" del navegador.
  const deferredLeaves = useDeferredValue(leaves)

  // Cache de findNodeForRows por grupo visible: TreeGrid vuelve a llamar
  // `column.aggregate(rows)` en cada render; el array `rows` de cada grupo
  // mantiene su referencia entre renders (useMemo interno de TreeGrid). La
  // WeakMap se renueva sola cuando cambia el arbol.
  const nodeForRowsCache = useMemo(
    () => new WeakMap<Row[], TreeNodeDTO | null>(),
    [root]
  )

  // Columna del arbol/indentacion: el ultimo nivel de agrupacion.
  const treeColumnId = useMemo(() => {
    if (groupByColumns.length > 0) return groupByColumns[groupByColumns.length - 1]
    const firstRow = deferredLeaves[0]
    if (firstRow) {
      const key = Object.keys(firstRow).find((k) => !valueColumns.includes(k))
      if (key) return key
    }
    return valueColumns[0] ?? 'id'
  }, [groupByColumns, valueColumns, deferredLeaves])

  const columns = useMemo<TreeGridColumn<Row>[]>(() => {
    const cols: TreeGridColumn<Row>[] = [
      {
        id: treeColumnId,
        header: treeColumnId,
        accessor: (row) => row[treeColumnId],
        type: 'text',
        width: 220,
        minWidth: 140,
        pinned: 'left',
      },
    ]
    for (const meta of data?.columnsMeta ?? []) {
      if (meta.id === treeColumnId) continue
      cols.push({
        id: meta.id,
        header: meta.header,
        // Hoja: valor por-fila ya calculado por el servidor. Grupo: valor del
        // nodo pre-agregado (respeta ratios/derived, que no se pueden sumar).
        accessor: (row) => row[meta.id],
        type: meta.type,
        decimals: meta.decimals,
        currency: meta.currency,
        align: 'right',
        width: 130,
        aggregate: (rows) => {
          if (root) {
            const cached = nodeForRowsCache.get(rows)
            const node =
              cached !== undefined ? cached : findNodeForRows(root, rows, groupByColumns)
            if (cached === undefined) nodeForRowsCache.set(rows, node)
            if (node) return node.metrics[meta.id] as number
          }
          const nums = rows.map((r) => Number(r[meta.id])).filter((n) => !Number.isNaN(n))
          return nums.reduce((a, b) => a + b, 0)
        },
      })
    }
    return cols
  }, [treeColumnId, data, root, groupByColumns, nodeForRowsCache, valueColumns])

  const groupBy = useMemo<TreeGridGroupLevel<Row>[]>(
    () =>
      groupByColumns.map((col) => ({
        id: col,
        label: col,
        accessor: (row) => String(row[col] ?? t('(empty)')),
      })),
    [groupByColumns, t]
  )

  // Filtros por columna de agrupacion, tipados segun los valores de las hojas.
  const filterDefinitions = useMemo<FilterDefinition[]>(() => {
    if (groupByColumns.length === 0) return []

    return groupByColumns.map((col) => {
      let filterType: 'select' | 'text' | 'dateRange' | 'numberRange' = 'select'
      let options: Array<{ value: string; label: string }> | undefined

      const uniqueValues = new Set<string>()
      deferredLeaves.forEach((row) => {
        const val = row[col]
        if (val != null) uniqueValues.add(String(val))
      })

      if (uniqueValues.size > 20) {
        filterType = 'text'
      } else if (uniqueValues.size > 0) {
        options = Array.from(uniqueValues)
          .sort()
          .map((val) => ({ value: val, label: val }))
      }

      return {
        field: col,
        type: filterType,
        label: col,
        options,
        placeholder: `Filtrar por ${col}...`,
      }
    })
  }, [groupByColumns, deferredLeaves])

  if (isLoading) return <WidgetLoading />
  if (needsDateFilter) {
    return <WidgetEmpty text={t('Choose a date range and press Query.')} />
  }
  if (error) {
    return <WidgetError error={t('Error fetching data: {{error}}', { error })} />
  }
  if (valueColumns.length === 0) {
    return (
      <p className='text-muted-foreground text-xs'>
        {t('Configure at least one value column to display this table.')}
      </p>
    )
  }
  if (leaves.length === 0) {
    return <WidgetEmpty text={t('No rows match the active filters.')} />
  }

  return (
    <TreeGrid
      key={`${widget.id}:${widget.xKey ?? ''}:${widget.yKey ?? ''}`}
      columns={columns}
      data={deferredLeaves}
      groupBy={groupBy}
      filterDefinitions={filterDefinitions}
      className='rounded-none border-0'
      showTotals
      totalsLabel={t('Total')}
      defaultExpandedDepth={1}
    />
  )
}
