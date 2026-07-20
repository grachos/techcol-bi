import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TreeGrid, type TreeGridColumn, type TreeGridGroupLevel } from '@/components/tree-grid'
import type { FilterDefinition } from '@/components/tree-grid/types-filters'
import { useWidgetData, type Row } from '@/hooks/use-widget-data'
import { type Aggregation, type Widget } from '@/lib/dashboard-api'
import {
  buildAggregationTree,
  buildRegistryFromModel,
  evaluateMetricForRows,
  getConnectorSemanticModel,
  useModelVersion,
  type AggregationNode,
} from '@/lib/semantic-layer'
import { type ActiveFilters } from '@/lib/widget-filters'
import { WidgetEmpty, WidgetError, WidgetLoading } from './widget-state'

interface TreeGridWidgetProps {
  widget: Widget
  activeFilters: ActiveFilters
}

function aggregateValues(values: number[], aggregation: Aggregation): number {
  if (values.length === 0) return 0
  switch (aggregation) {
    case 'avg':
      return values.reduce((sum, v) => sum + v, 0) / values.length
    case 'count':
      return values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    default:
      return values.reduce((sum, v) => sum + v, 0)
  }
}

/**
 * <TreeGrid> arma su propia jerarquia internamente y solo entrega, por
 * columna, las filas crudas de cada grupo visible (`aggregate: (rows) =>
 * ...`) -- no expone a que nodo del arbol corresponden. Para reusar el
 * arbol ya calculado por buildAggregationTree() sin cambiar el contrato del
 * componente generico, se reconstruye el nodo a partir de esas mismas filas:
 * como todas comparten el mismo valor en las dimensiones ya fijadas (las
 * que agrupan ese nivel), el prefijo de dimensiones donde TODAS las filas
 * coinciden identifica exactamente la profundidad y el camino del nodo.
 */
function findNodeForRows(root: AggregationNode, rows: Row[], dims: string[]): AggregationNode | null {
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
  const { filteredRows, error, isLoading, needsDateFilter } = useWidgetData(
    widget,
    activeFilters
  )

  const rawGroupByColumns = useMemo(
    () => (widget.xKey ? widget.xKey.split(',').filter(Boolean) : []),
    [widget.xKey]
  )
  const rawValueColumns = useMemo(
    () => (widget.yKey ? widget.yKey.split(',').filter(Boolean) : []),
    [widget.yKey]
  )
  const aggregation = widget.aggregation ?? 'sum'

  // Modelo semantico del conector: dimensiones/medidas base inferidas de las
  // filas + medidas calculadas que el usuario haya creado (ej. "rentabilidad"
  // desde el panel de Metricas). Una columna de valor que coincida con una
  // medida registrada se resuelve via Query Engine (recalculando la formula
  // por nodo, correcto para ratios); si no, cae al agregado crudo de siempre.
  const semanticModel = useMemo(
    () => (widget.connectorId ? getConnectorSemanticModel(widget.connectorId, filteredRows) : null),
    [widget.connectorId, filteredRows]
  )
  const modelVersion = useModelVersion(semanticModel)

  // Si el widget quedo configurado con una columna que ya no existe (ej. se
  // borro la metrica calculada que se habia elegido para agrupar/valor), se
  // descarta en vez de intentar agrupar/graficar por un valor inexistente:
  // eso producia un unico grupo "(vacio)" con todas las filas y podia romper
  // el render de la tabla.
  const availableColumnNames = useMemo(() => {
    const names = new Set(filteredRows[0] ? Object.keys(filteredRows[0]) : [])
    semanticModel?.listMeasures().forEach((m) => names.add(m.name))
    return names
    // modelVersion: el Set de nombres de medidas debe recalcularse cuando se
    // agrega/edita/borra una metrica, aunque `semanticModel` (el objeto) no
    // cambie de referencia -- es mutable y se cachea por conector.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, semanticModel, modelVersion])
  const groupByColumns = useMemo(
    () => rawGroupByColumns.filter((c) => availableColumnNames.has(c)),
    [rawGroupByColumns, availableColumnNames]
  )
  const valueColumns = useMemo(
    () => rawValueColumns.filter((c) => availableColumnNames.has(c)),
    [rawValueColumns, availableColumnNames]
  )

  // Registro de medidas para el motor de arbol jerarquico (simple/leaf/
  // derived -- ver semantic-layer/tree-engine): agrupa correctamente incluso
  // formulas que mezclan columnas de distinto grano (ej. "Margen" marcada
  // como 'leaf'), sin tener que tocar las columnas que ya funcionaban bien.
  // Igual que arriba, `modelVersion` fuerza a reconstruir el registro
  // cuando el usuario edita una metrica sin recargar la pagina.
  const registry = useMemo(
    () => (semanticModel ? buildRegistryFromModel(semanticModel) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [semanticModel, modelVersion]
  )
  const tree = useMemo(
    () => (registry ? buildAggregationTree(filteredRows, groupByColumns, registry) : null),
    [registry, filteredRows, groupByColumns]
  )

  // Cache de findNodeForRows por grupo visible: TreeGrid vuelve a llamar
  // `column.aggregate(rows)` en cada render (scroll, hover, filtros de UI
  // que no tocan los datos), y el array `rows` de cada grupo mantiene la
  // misma referencia entre esos renders (viene de un useMemo interno de
  // TreeGrid). Sin esta cache, findNodeForRows() volvia a escanear todas
  // las filas del grupo -- para cada una de las N columnas de valor -- en
  // cada frame de scroll, notorio con miles de filas. Se limpia solo (una
  // WeakMap nueva) cuando el arbol se reconstruye de verdad.
  const nodeForRowsCache = useMemo(
    () => new WeakMap<Row[], AggregationNode | null>(),
    [tree]
  )
  function findNodeForRowsCached(rows: Row[]): AggregationNode | null {
    if (!tree) return null
    const cached = nodeForRowsCache.get(rows)
    if (cached !== undefined) return cached
    const node = findNodeForRows(tree, rows, groupByColumns)
    nodeForRowsCache.set(rows, node)
    return node
  }

  // Columna usada para el arbol/indentacion: el ultimo nivel de agrupacion si
  // hay, si no la primera columna de los datos que no sea una columna de valor.
  const treeColumnId = useMemo(() => {
    if (groupByColumns.length > 0) return groupByColumns[groupByColumns.length - 1]
    const firstRow = filteredRows[0]
    if (firstRow) {
      const key = Object.keys(firstRow).find((k) => !valueColumns.includes(k))
      if (key) return key
    }
    return valueColumns[0] ?? 'id'
  }, [groupByColumns, valueColumns, filteredRows])

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
    for (const col of valueColumns) {
      if (col === treeColumnId) continue
      // Una columna de valor que coincide con una medida del modelo semantico
      // (base o calculada, ej. "rentabilidad") se evalua via Query Engine:
      // recalcula la formula sobre las filas de cada nodo, en vez de sumar
      // valores crudos -- unico modo correcto para razones/porcentajes.
      const measure = semanticModel?.getMeasure(col)
      // El formato de la medida (ej. "porcentaje, 1 decimal" para un ratio
      // como Rentabilidad) debe llegar a la columna del grid: sin esto, todo
      // valor de la medida se mostraba como entero (0 decimales por defecto),
      // y cualquier ratio entre 0 y 1 se veia redondeado a "0".
      const formatType = measure?.format?.type
      cols.push({
        id: col,
        header: measure?.label ?? col,
        accessor: (row) =>
          measure && semanticModel ? evaluateMetricForRows(semanticModel, [row], col) : row[col],
        type: formatType === 'percent' || formatType === 'currency' ? formatType : 'number',
        decimals: measure?.format?.decimals,
        currency: measure?.format?.currency,
        align: 'right',
        width: 130,
        // Agregacion por nodo: si `col` es una medida registrada, se busca
        // el nodo ya calculado por buildAggregationTree() y se usa su valor
        // (respeta 'simple'/'leaf'/'derived' -- ver tree-engine). Si no,
        // cae al agregado crudo de siempre (columna sin metrica asociada).
        aggregate: (rows) => {
          if (registry?.has(col) && tree) {
            const node = findNodeForRowsCached(rows)
            if (node) return node.metrics[col]
          }
          return aggregateValues(
            rows.map((r) => Number(r[col])).filter((n) => !Number.isNaN(n)),
            aggregation
          )
        },
      })
    }
    return cols
  }, [treeColumnId, valueColumns, aggregation, semanticModel, registry, tree, groupByColumns])

  const groupBy = useMemo<TreeGridGroupLevel<Row>[]>(
    () =>
      groupByColumns.map((col) => ({
        id: col,
        label: col,
        accessor: (row) => String(row[col] ?? t('(empty)')),
      })),
    [groupByColumns, t]
  )

  // Crear automáticamente definiciones de filtros para las columnas de agrupación
  // Detecta el tipo de dato observando los valores en las filas
  const filterDefinitions = useMemo<FilterDefinition[]>(() => {
    if (groupByColumns.length === 0) return []

    return groupByColumns.map((col) => {
      // Detectar tipo de dato examinando los valores
      let filterType: 'select' | 'text' | 'dateRange' | 'numberRange' = 'select'
      let options: Array<{ value: string; label: string }> | undefined

      // Obtener valores únicos para este campo
      const uniqueValues = new Set<string>()
      filteredRows.forEach((row) => {
        const val = row[col]
        if (val != null) {
          uniqueValues.add(String(val))
        }
      })

      // Si hay muchos valores únicos, cambiar a filtro de texto
      if (uniqueValues.size > 20) {
        filterType = 'text'
      } else if (uniqueValues.size > 0) {
        options = Array.from(uniqueValues)
          .sort()
          .map((val) => ({
            value: val,
            label: val,
          }))
      }

      return {
        field: col,
        type: filterType,
        label: col,
        options,
        placeholder: `Filtrar por ${col}...`,
      }
    })
  }, [groupByColumns, filteredRows, t])

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
  if (filteredRows.length === 0) {
    return <WidgetEmpty text={t('No rows match the active filters.')} />
  }

  return (
    <TreeGrid
      key={`${widget.id}:${widget.xKey ?? ''}:${widget.yKey ?? ''}:${aggregation}`}
      columns={columns}
      data={filteredRows}
      groupBy={groupBy}
      filterDefinitions={filterDefinitions}
      className='rounded-none border-0'
      showTotals
      totalsLabel={t('Total')}
      defaultExpandedDepth={1}
    />
  )
}
